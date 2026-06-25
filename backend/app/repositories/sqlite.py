from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from backend.app.schemas.match import Match
from backend.app.schemas.model_config import ModelConfig
from backend.app.schemas.prediction import PredictionResult, PredictionScores
from backend.app.schemas.team import TeamProfile

DB_PATH = Path(__file__).resolve().parents[3] / "football-agent.db"
CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache"
SCOREBOARD_DIR = CACHE_DIR / "scoreboard"


class SqliteRepository:
    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self.ensure_schema()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def ensure_schema(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS py_model_configs (
                    name TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS py_predictions (
                    match_id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def list_matches(self, start: str | None = None, end: str | None = None) -> list[Match]:
        matches: list[Match] = []
        if not SCOREBOARD_DIR.exists():
            return matches
        for file in SCOREBOARD_DIR.glob("*.json"):
            try:
                payload = json.loads(file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            for event in payload.get("payload", {}).get("events", []):
                match = self._event_to_match(event)
                if not match:
                    continue
                if start and match.date < start:
                    continue
                if end and match.date > end:
                    continue
                matches.append(match)
        unique: dict[str, Match] = {}
        for match in matches:
            unique[match.id] = match
        return sorted(unique.values(), key=lambda item: (item.date, item.kickoff_time or "", item.id))

    def get_prediction(self, match_id: str) -> PredictionResult | None:
        with self.connect() as conn:
            row = conn.execute("SELECT payload_json FROM py_predictions WHERE match_id = ?", (match_id,)).fetchone()
            if row:
                return PredictionResult.model_validate_json(row["payload_json"])
            row = conn.execute(
                """
                SELECT prediction_key, match_id, match_date, home, away, summary_json, generated_at
                FROM predictions
                WHERE match_id = ? OR prediction_key = ?
                ORDER BY generated_at DESC
                LIMIT 1
                """,
                (match_id, match_id),
            ).fetchone()
        if not row:
            return None
        return self._legacy_prediction_to_result(row)

    def list_predictions(self) -> dict[str, PredictionResult]:
        results: dict[str, PredictionResult] = {}
        with self.connect() as conn:
            rows = conn.execute("SELECT match_id, payload_json FROM py_predictions").fetchall()
            for row in rows:
                prediction = PredictionResult.model_validate_json(row["payload_json"])
                results[row["match_id"]] = prediction
            legacy_rows = conn.execute(
                """
                SELECT prediction_key, match_id, match_date, home, away, summary_json, generated_at
                FROM predictions
                ORDER BY generated_at DESC
                """
            ).fetchall()
        for row in legacy_rows:
            key = row["prediction_key"] or row["match_id"]
            if key and key not in results:
                results[key] = self._legacy_prediction_to_result(row)
        return results

    def save_prediction(self, prediction: PredictionResult) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO py_predictions (match_id, payload_json)
                VALUES (?, ?)
                ON CONFLICT(match_id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    generated_at = CURRENT_TIMESTAMP
                """,
                (prediction.match_id, prediction.model_dump_json()),
            )

    def list_model_configs(self) -> list[ModelConfig]:
        with self.connect() as conn:
            rows = conn.execute("SELECT payload_json FROM py_model_configs ORDER BY updated_at DESC").fetchall()
        return [ModelConfig.model_validate_json(row["payload_json"]) for row in rows]

    def upsert_model_config(self, config: ModelConfig) -> None:
        safe_payload = config.model_dump(mode="json")
        safe_payload["api_key"] = config.api_key.get_secret_value()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO py_model_configs (name, payload_json)
                VALUES (?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (config.name, json.dumps(safe_payload, ensure_ascii=False)),
            )

    def get_team(self, team_id: str) -> TeamProfile | None:
        with self.connect() as conn:
            row = conn.execute("SELECT payload_json FROM teams WHERE team = ?", (team_id,)).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload_json"])
        return TeamProfile(id=team_id, name=payload.get("team", team_id), name_zh=payload.get("team"))

    def _event_to_match(self, event: dict[str, Any]) -> Match | None:
        competition = (event.get("competitions") or [{}])[0]
        competitors = competition.get("competitors") or []
        home = next((item for item in competitors if item.get("homeAway") == "home"), competitors[0] if competitors else {})
        away = next((item for item in competitors if item.get("homeAway") == "away"), competitors[1] if len(competitors) > 1 else {})
        home_name = home.get("team", {}).get("displayName")
        away_name = away.get("team", {}).get("displayName")
        if not home_name or not away_name:
            return None
        date_utc = self._parse_espn_date(event.get("date"))
        score = self._score_text(home, away)
        return Match(
            id=f"espn-{event.get('id')}",
            date=date_utc.date().isoformat(),
            home=home_name,
            away=away_name,
            competition="FIFA World Cup",
            competition_type="world_cup",
            group=competition.get("notes", [{}])[0].get("headline") if competition.get("notes") else None,
            venue=competition.get("venue", {}).get("fullName"),
            kickoff_time=date_utc.strftime("%H:%M"),
            status="review" if score else "scheduled",
            score=score or "未赛",
        )

    def _parse_espn_date(self, value: str | None) -> datetime:
        if not value:
            return datetime.now(timezone.utc)
        normalized = value.replace("Z", "+00:00")
        utc_dt = datetime.fromisoformat(normalized)
        return utc_dt + timedelta(hours=8)

    def _score_text(self, home: dict[str, Any], away: dict[str, Any]) -> str | None:
        home_score = home.get("score")
        away_score = away.get("score")
        if home_score is None or away_score is None:
            return None
        if str(home_score) == "0" and str(away_score) == "0":
            return None
        return f"{home_score}-{away_score}"

    def _legacy_prediction_to_result(self, row: sqlite3.Row) -> PredictionResult:
        summary = json.loads(row["summary_json"]) if row["summary_json"] else {}
        confidence = self._int_value(summary.get("confidence_score"), default=0)
        analysis = self._int_value(summary.get("analysis_score"), default=0)
        return PredictionResult(
            match_id=row["match_id"] or row["prediction_key"],
            winner=self._text_value(summary.get("winner") or summary.get("win_tendency") or summary.get("full_time"), "未明确"),
            total_goals=self._text_value(summary.get("total_goals") or summary.get("goals") or summary.get("over_under"), "未明确"),
            half_full=self._text_value(summary.get("half_full") or summary.get("ht_ft"), "未明确"),
            score_pick=self._text_value(summary.get("score") or summary.get("score_range"), "未明确"),
            first_half_summary=self._text_value(summary.get("first_half"), "未明确"),
            full_time_summary=self._text_value(summary.get("full_time"), "未明确"),
            scores=PredictionScores(
                source_score=analysis,
                analysis_score=analysis,
                winner_confidence=confidence,
                goals_confidence=max(0, confidence - 8),
                score_confidence=max(0, confidence - 28),
                half_full_confidence=max(0, confidence - 14),
            ),
            report=self._text_value(summary.get("filter_reason") or summary.get("key_evidence"), "旧预测已读取，报告待重新生成。"),
            generated_at=row["generated_at"],
        )

    def _text_value(self, value: Any, default: str) -> str:
        if value is None or value == "":
            return default
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return "；".join(self._text_value(item, "") for item in value if item)
        if isinstance(value, dict):
            for key in ("summary", "text", "result", "trend", "boundary", "note"):
                if key in value:
                    return self._text_value(value[key], default)
            return "；".join(f"{key}：{self._text_value(item, '')}" for key, item in value.items())
        return str(value)

    def _int_value(self, value: Any, default: int) -> int:
        try:
            return max(0, min(100, int(float(str(value).replace("%", "")))))
        except (TypeError, ValueError):
            return default


def get_repository() -> SqliteRepository:
    return SqliteRepository()
