window.WORLD_CUP_FIXTURES = [
  {
    id: "esp-cpv-2026-06-15",
    status: "review",
    date: "2026-06-15",
    group: "H组",
    venue: "亚特兰大",
    home: "西班牙",
    away: "佛得角",
    score: "0-0",
    resultNote: "西班牙场面优势明显，但没有把控球转化成进球。",
    headline: "强弱差真实存在，但“大胜”不等于赛前高确定性。",
    recommendation: "复盘样本",
    confidence: 61,
    factors: {
      strength: {
        score: 86,
        summary: "西班牙整体实力明显高于佛得角，但实力优势首先对应控场概率，不直接等于早段进球。",
        evidence: "赛后射门和传球数据说明场面优势存在；0-0说明终结效率、低位密集防守和门将表现能显著影响结果。",
        sources: ["The Guardian 赛后复盘", "ESPN / FIFA 比赛统计"]
      },
      coach: {
        score: 58,
        summary: "赛前可推断佛得角会优先保护禁区；西班牙首战没有必要从开局就承担过大反击风险。",
        evidence: "这种判断需要用教练发布会、首发结构、过往面对强队/弱队时的开局策略验证，不能只凭球队名气。",
        sources: ["赛前发布会", "官方首发", "过往同类比赛录像"]
      },
      tactics: {
        score: 76,
        summary: "控球强队面对深防线时，关键不是控球率，而是能否制造禁区内高质量机会。",
        evidence: "如果边路一对一、肋部渗透或定位球质量不足，强队会出现“围而不破”。",
        sources: ["比赛事件数据", "射门质量数据"]
      },
      players: {
        score: 52,
        summary: "关键破局球员状态会影响上半场穿透力。",
        evidence: "如果核心边路或组织点不是完整状态，强队控球优势会被削弱。",
        sources: ["球队官方伤情", "首发名单"]
      },
      motivation: {
        score: 64,
        summary: "小组赛首战通常提高“不先犯错”的价值，弱队尤其能接受低比分。",
        evidence: "动机不是只看强队想赢，也要看弱队是否把平局视为可接受结果。",
        sources: ["小组积分形势", "教练发布会"]
      },
      market: {
        score: 47,
        summary: "市场校验只作为风险对照，不作为主判断。",
        evidence: "如果大众预期集中在强队大胜，而战术层面存在低位防守难题，应降低让球和大胜方向。",
        sources: ["主流赔率变化", "盘口变化"]
      },
      uncertainty: {
        score: 72,
        summary: "门将超常发挥、终结波动和门柱等事件无法赛前稳定预测。",
        evidence: "这类变量只能提高过滤权重，不能被包装成确定性结论。",
        sources: ["赛后事件数据"]
      }
    },
    verdicts: [
      ["上半场低比分", "mid", "可以研究", "0-0/1-0区间比“大胜叙事”更值得关注。"],
      ["西班牙大胜", "high", "建议跳过", "强弱差成立，但穿透能力和赔率回报未必匹配。"],
      ["精确比分", "high", "建议跳过", "0-0属于可解释结果，不是赛前应主推的结果。"]
    ],
    scripts: {
      half: "西班牙控球，佛得角低位收缩。上半场能否打开，取决于边路破局、禁区二点和定位球质量。",
      full: "如果迟迟不进，西班牙会增加压迫和替补攻击点，但心理急躁和终结波动也会上升。",
      scenarios: [
        ["半场0-0", 42],
        ["半场1球", 34],
        ["西班牙半场多球", 16],
        ["佛得角先进球", 8]
      ]
    }
  },
  {
    id: "irq-nor-2026-06-16",
    status: "review",
    date: "2026-06-16",
    group: "I组",
    venue: "波士顿",
    home: "伊拉克",
    away: "挪威",
    score: "1-4",
    resultNote: "挪威净胜三球，但上半场过程并不顺滑。",
    headline: "全场优势和上半场过程优势必须分开判断。",
    recommendation: "复盘样本",
    confidence: 67,
    factors: {
      strength: {
        score: 79,
        summary: "挪威前场终结上限明显更高，90分钟内拉开比分的能力强于伊拉克。",
        evidence: "哈兰德、厄德高等球员决定了挪威的进攻上限，但这不等于后场出球不会被压迫。",
        sources: ["官方首发", "比赛事件数据"]
      },
      coach: {
        score: 63,
        summary: "伊拉克存在阶段性高位逼抢的策略空间，但赛前不能把它当确定主剧本。",
        evidence: "需要核对主帅过往面对强队时是否使用前场压迫、压迫持续时间、换人节点和赛前表态。",
        sources: ["教练发布会", "过往比赛录像", "官方首发"]
      },
      tactics: {
        score: 71,
        summary: "挪威后场抗压并非无懈可击，伊拉克上半场强度能制造威胁。",
        evidence: "高压是否有效取决于前锋、中场和边路同步，以及挪威中卫/门将出球质量。",
        sources: ["比赛录像", "压迫事件数据"]
      },
      players: {
        score: 82,
        summary: "挪威的个体终结点能把少数机会转化成比分优势。",
        evidence: "强队终局优势往往来自球星效率、替补深度和对方体能回落后的空间。",
        sources: ["球员进攻数据", "替补名单"]
      },
      motivation: {
        score: 69,
        summary: "久别世界杯的情绪不只增强挪威，也会增强伊拉克开局对抗强度。",
        evidence: "首战情绪应双向评估，不能只套用强队叙事。",
        sources: ["赛前采访", "小组赛背景"]
      },
      market: {
        score: 51,
        summary: "热门方向可能集中在挪威全场胜和赢两半，后者风险更高。",
        evidence: "市场校验的作用是识别“结果热门但过程不稳”的标的。",
        sources: ["主流赔率变化"]
      },
      uncertainty: {
        score: 66,
        summary: "门将失误、体能断崖和换人效果会改变下半场。",
        evidence: "这些变量能解释赛后比分，但不能赛前精确锁定。",
        sources: ["赛后事件数据"]
      }
    },
    verdicts: [
      ["挪威全场优势", "low", "可以研究", "球星和终结点支持90分钟优势。"],
      ["挪威赢两半", "high", "建议跳过", "伊拉克前45分钟强度风险不能忽视。"],
      ["上半场过程风险", "mid", "必须写入", "挪威可能赢球，但上半场未必压制。"]
    ],
    scripts: {
      half: "挪威未必持续压制。伊拉克如果阶段性高位逼抢有效，挪威后场会暴露出球压力。",
      full: "挪威更适合在后60分钟兑现终结优势；伊拉克高强度策略有体能衰减风险。",
      scenarios: [
        ["挪威半场领先", 38],
        ["半场打平", 36],
        ["伊拉克有效压迫", 44],
        ["下半场拉开", 57]
      ]
    }
  },
  {
    id: "ned-jpn-2026-06-14",
    status: "review",
    date: "2026-06-14",
    group: "F组",
    venue: "达拉斯",
    home: "荷兰",
    away: "日本",
    score: "2-2",
    resultNote: "半场0-0，下半场由比分触发和换人调整变得开放。",
    headline: "上半场谨慎可以推演，全场精确比分不应主推。",
    recommendation: "复盘样本",
    confidence: 64,
    factors: {
      strength: {
        score: 62,
        summary: "荷兰有身体和局部能力优势，但日本组织性足以抵消部分差距。",
        evidence: "这不是实力断层局，战术纪律和转换防守会显著影响上半场。",
        sources: ["球队近期比赛", "官方首发"]
      },
      coach: {
        score: 68,
        summary: "小组首战双方都没有必要过早暴露身后空间。",
        evidence: "应核对双方教练在首战、强强对话、0-0阶段的风险偏好。",
        sources: ["赛前发布会", "历史同类比赛"]
      },
      tactics: {
        score: 70,
        summary: "荷兰宽度和身体优势对日本整体移动，前45分钟更可能互相试探。",
        evidence: "如果双方都担心被转换打身后，上半场节奏会低于球员名气暗示。",
        sources: ["比赛录像", "战术报告"]
      },
      players: {
        score: 61,
        summary: "个体发挥决定下半场效率，但赛前很难锁定具体爆点。",
        evidence: "球员状态可以影响转折点，但不能替代初始剧本判断。",
        sources: ["球员近期状态", "首发名单"]
      },
      motivation: {
        score: 66,
        summary: "首战不败价值较高，0-0阶段双方都能接受。",
        evidence: "动机越接近平衡，上半场越容易先控制风险。",
        sources: ["小组积分形势"]
      },
      market: {
        score: 54,
        summary: "荷兰名气可能抬高胜方热度，但日本不是低组织弱队。",
        evidence: "市场偏向需要和战术对位相互验证。",
        sources: ["赔率变化"]
      },
      uncertainty: {
        score: 68,
        summary: "下半场比分触发会快速改变双方风险偏好。",
        evidence: "2-2更适合作为赛后解释，不应倒推成赛前确定结论。",
        sources: ["赛后进球时间线"]
      }
    },
    verdicts: [
      ["上半场谨慎", "low", "可以研究", "0-0/1球区间比胜负名气更重要。"],
      ["荷兰轻松胜", "high", "建议跳过", "日本战术纪律不支持这个简化判断。"],
      ["全场精确比分", "high", "建议跳过", "下半场触发链不可赛前稳定押中。"]
    ],
    scripts: {
      half: "双方都担心被对手转换打身后，开局更可能在中场和边路争夺控制权。",
      full: "一旦先丢球，日本会提高进攻投入；荷兰领先后是否回收会决定比赛是否重新开放。",
      scenarios: [
        ["半场0-0", 45],
        ["半场1球", 35],
        ["下半场开放", 54],
        ["荷兰全场小胜", 33]
      ]
    }
  },
  {
    id: "gha-pan-2026-06-17",
    status: "actionable",
    date: "2026-06-17",
    group: "L组",
    venue: "多伦多",
    home: "加纳",
    away: "巴拿马",
    score: "未赛",
    resultNote: "未赛样本。适合做上半场节奏和低比分倾向的赛前分析。",
    headline: "双方不是实力断层局，风格碰撞比名气更重要。",
    recommendation: "推荐关注：上半场节奏",
    confidence: 57,
    factors: {
      strength: {
        score: 58,
        summary: "加纳个体速度和冲击力更强，但稳定控制力未必压倒巴拿马。",
        evidence: "这种比赛应先判断局部速度能否转化为持续压制，而不是直接判断大胜。",
        sources: ["官方首发", "球队近期比赛", "FIFA/ESPN 赛程"]
      },
      coach: {
        score: 56,
        summary: "双方首战都不应过早失衡，教练风险偏好需要用首发和发布会验证。",
        evidence: "需要查看教练面对同档球队时是否开局高压、是否接受半场平局、换人节点是否激进。",
        sources: ["官方发布会", "历史同类比赛"]
      },
      tactics: {
        score: 65,
        summary: "加纳转换速度对巴拿马防线回追是主矛盾，巴拿马可能通过身体对抗切碎节奏。",
        evidence: "如果前20分钟没有早球，比赛更容易进入犯规、定位球和中场消耗。",
        sources: ["比赛录像", "事件数据"]
      },
      players: {
        score: 57,
        summary: "关键在加纳边路爆点和巴拿马中卫对抗质量。",
        evidence: "需要补充大名单、首发年龄结构、俱乐部联赛等级和身体对抗数据。",
        sources: ["国家队大名单", "俱乐部数据"]
      },
      motivation: {
        score: 62,
        summary: "小组首轮，平局对双方都不是灾难。",
        evidence: "动机不支持双方从开局就大幅冒险。",
        sources: ["小组赛程", "积分形势"]
      },
      market: {
        score: 50,
        summary: "市场校验只用于判断加纳热度是否过高。",
        evidence: "如果让球明显偏深但首发和战术不支持压制，应降级。",
        sources: ["赔率变化"]
      },
      uncertainty: {
        score: 60,
        summary: "犯规尺度与定位球会显著影响节奏。",
        evidence: "裁判尺度和定位球质量属于赛前可评估但不稳定的风险项。",
        sources: ["裁判信息", "定位球数据"]
      }
    },
    verdicts: [
      ["上半场谨慎偏对抗", "mid", "可以研究", "节奏可能被犯规和中场争夺切碎。"],
      ["加纳大胜", "high", "建议跳过", "优势主要在局部速度，不是全场控制断层。"],
      ["全场胜负", "mid", "谨慎处理", "可以判断倾向，但不应强推。"]
    ],
    scripts: {
      half: "加纳会寻找边路和身后，巴拿马更可能用对抗与定位球回应。若前20分钟没有早球，半场低比分概率上升。",
      full: "后程取决于谁先打破僵局。加纳领先会放大转换空间；巴拿马守住会把比赛带向定位球和犯规消耗。",
      scenarios: [
        ["半场0-0", 37],
        ["半场1球", 40],
        ["加纳局部压制", 48],
        ["定位球改变比赛", 31]
      ]
    }
  },
  {
    id: "por-cod-2026-06-17",
    status: "avoid",
    date: "2026-06-17",
    group: "K组",
    venue: "休斯敦",
    home: "葡萄牙",
    away: "刚果（金）",
    score: "未赛",
    resultNote: "未赛样本。强队优势明显，但大胜和半场穿透需要降级。",
    headline: "强弱差不等于上半场顺利穿透。",
    recommendation: "建议跳过：强队大胜方向",
    confidence: 47,
    factors: {
      strength: {
        score: 76,
        summary: "葡萄牙整体实力更强，但这类断层局的难点是强队态度和穿透效率。",
        evidence: "如果强队轮换、控制风险或弱队低位质量较高，半场可能不顺。",
        sources: ["官方首发", "球队伤停", "赔率变化"]
      },
      coach: {
        score: 45,
        summary: "葡萄牙是否开局强压、是否轮换关键球员，赛前需要可靠信息。",
        evidence: "没有首发和发布会支撑时，不应推半场大胜。",
        sources: ["官方发布会", "官方首发"]
      },
      tactics: {
        score: 57,
        summary: "刚果（金）若低位收缩并保留反击点，会压低比赛早段空间。",
        evidence: "断层局重点是弱队能守多久，而不是只问强队能不能赢。",
        sources: ["球队近期比赛", "战术数据"]
      },
      players: {
        score: 64,
        summary: "葡萄牙替补深度强，但首发选择会直接影响上半场强度。",
        evidence: "需要看关键边路、前腰和中锋是否首发。",
        sources: ["官方首发", "球员状态"]
      },
      motivation: {
        score: 59,
        summary: "小组赛强队目标是赢球，但未必从第一分钟追求大比分。",
        evidence: "若下一场更关键或赛程密集，强队可能控制消耗。",
        sources: ["赛程", "发布会"]
      },
      market: {
        score: 62,
        summary: "如果市场过度压低葡萄牙大胜回报，应提高过滤权重。",
        evidence: "市场校验在这里主要用于识别热门拥挤。",
        sources: ["赔率变化"]
      },
      uncertainty: {
        score: 78,
        summary: "轮换、态度和早球依赖度过高。",
        evidence: "这类比赛可以预测强队优势，但不适合强推半场或大胜。",
        sources: ["系统默认规则"]
      }
    },
    verdicts: [
      ["葡萄牙全场优势", "low", "可以研究", "实力优势明确。"],
      ["葡萄牙半场大胜", "high", "建议跳过", "轮换和弱队低位会放大不确定性。"],
      ["精确比分", "high", "建议跳过", "断层局精确比分高度依赖早球和终结效率。"]
    ],
    scripts: {
      half: "葡萄牙大概率控球，但若刚果（金）低位组织完整，半场穿透效率不一定高。",
      full: "下半场空间、体能和替补深度更可能帮助葡萄牙扩大优势。",
      scenarios: [
        ["葡萄牙半场领先", 49],
        ["半场低比分", 43],
        ["大胜穿盘风险", 71],
        ["下半场拉开", 56]
      ]
    }
  },
  {
    id: "cro-eng-2026-06-17",
    status: "actionable",
    date: "2026-06-17",
    group: "L组",
    venue: "达拉斯",
    home: "克罗地亚",
    away: "英格兰",
    score: "未赛",
    resultNote: "未赛样本。强强/准强强对话更适合做教练策略和上半场节奏分析。",
    headline: "实力接近时，教练初始策略和中场对位权重上升。",
    recommendation: "推荐关注：上半场谨慎",
    confidence: 63,
    factors: {
      strength: {
        score: 66,
        summary: "英格兰纸面深度更强，但克罗地亚经验和中场控制能抵消部分差距。",
        evidence: "实力不构成断层，不能直接推英格兰轻松压制。",
        sources: ["官方首发", "球员俱乐部等级", "近期比赛"]
      },
      coach: {
        score: 68,
        summary: "这类比赛的开局风险偏好通常比球星名气更重要。",
        evidence: "需要核对双方教练在强强战是否先稳中场、是否接受半场0-0、是否早换人。",
        sources: ["发布会", "历史强强战"]
      },
      tactics: {
        score: 72,
        summary: "中场压迫、二点球和边路保护会决定上半场节奏。",
        evidence: "若双方都限制对手转换，前45分钟更可能谨慎。",
        sources: ["战术报告", "比赛录像"]
      },
      players: {
        score: 70,
        summary: "英格兰前场爆点更足，克罗地亚中场经验更强。",
        evidence: "球员对位不是单看总身价，要拆到中场和边路。",
        sources: ["球员资料", "俱乐部联赛等级"]
      },
      motivation: {
        score: 66,
        summary: "小组赛关键战，不败和控制风险的价值较高。",
        evidence: "双方都不愿让比赛过早进入开放对攻。",
        sources: ["小组形势"]
      },
      market: {
        score: 55,
        summary: "英格兰热度需要和中场控制风险对照。",
        evidence: "如果市场过度偏向英格兰，应警惕胜方热度。",
        sources: ["赔率变化"]
      },
      uncertainty: {
        score: 58,
        summary: "不确定性中等，主要来自首发和临场风险偏好。",
        evidence: "信息补齐后，这类比赛比断层局更适合分析上半场。",
        sources: ["官方首发", "发布会"]
      }
    },
    verdicts: [
      ["上半场谨慎", "mid", "可以研究", "双方都有理由先控制风险。"],
      ["英格兰轻松胜", "high", "建议跳过", "克罗地亚中场和经验不支持简化判断。"],
      ["半场低比分", "mid", "可以研究", "强强局前45分钟更依赖风险偏好。"]
    ],
    scripts: {
      half: "双方会优先争夺中场控制和转换保护，直接开放对攻的概率不高。",
      full: "下半场换人和体能会放大英格兰深度优势，但克罗地亚经验会降低崩盘概率。",
      scenarios: [
        ["半场0-0", 41],
        ["半场1球", 38],
        ["英格兰后程加速", 46],
        ["克罗地亚守住节奏", 39]
      ]
    }
  },
  {
    id: "uzb-col-2026-06-18",
    status: "watch",
    date: "2026-06-18",
    group: "K组",
    venue: "墨西哥城",
    home: "乌兹别克斯坦",
    away: "哥伦比亚",
    score: "未赛",
    resultNote: "未赛样本。哥伦比亚优势存在，但新军韧性和低位质量需要补资料。",
    headline: "强弱中间局，适合先观察资料完整度。",
    recommendation: "谨慎观察：待补阵容",
    confidence: 53,
    factors: {
      strength: {
        score: 68,
        summary: "哥伦比亚个体能力更强，但乌兹别克斯坦并非纯送分队。",
        evidence: "需要判断乌兹别克斯坦低位组织和转换质量。",
        sources: ["官方大名单", "球队近期比赛"]
      },
      coach: {
        score: 52,
        summary: "教练策略信号不足，不能确定乌兹别克斯坦是否只守不攻。",
        evidence: "需要看其面对高水平球队时是否敢压迫、是否保守到只争0-0。",
        sources: ["发布会", "过往比赛"]
      },
      tactics: {
        score: 61,
        summary: "哥伦比亚边路和前场个人能力是优势，乌兹别克斯坦可能用紧凑阵型压缩空间。",
        evidence: "上半场是否顺利取决于哥伦比亚能否早段制造高质量机会。",
        sources: ["比赛录像", "事件数据"]
      },
      players: {
        score: 65,
        summary: "哥伦比亚关键攻击手质量更高，但首发完整性仍需确认。",
        evidence: "需要大名单、首发和球员俱乐部等级分布。",
        sources: ["官方首发", "球员资料"]
      },
      motivation: {
        score: 61,
        summary: "小组首战双方都有拿分诉求。",
        evidence: "弱队若接受平局，上半场会更保守。",
        sources: ["小组形势"]
      },
      market: {
        score: 57,
        summary: "哥伦比亚热门合理，但若盘口过深需要谨慎。",
        evidence: "市场校验用于判断强队优势是否被过度定价。",
        sources: ["赔率变化"]
      },
      uncertainty: {
        score: 70,
        summary: "新军信息不透明，资料不足前不应升为强推荐。",
        evidence: "未知越多，越应保留在谨慎观察。",
        sources: ["系统默认规则"]
      }
    },
    verdicts: [
      ["哥伦比亚优势", "mid", "谨慎研究", "实力倾向存在。"],
      ["哥伦比亚半场领先", "high", "暂不主推", "新军低位和首战谨慎可能拖慢节奏。"],
      ["资料补齐后再判断", "low", "优先动作", "先补教练和首发信息。"]
    ],
    scripts: {
      half: "哥伦比亚会寻找边路和个人突破，乌兹别克斯坦大概率优先保护禁区。",
      full: "如果乌兹别克斯坦体能和低位质量下降，哥伦比亚后程优势会上升。",
      scenarios: [
        ["半场低比分", 42],
        ["哥伦比亚半场小优", 35],
        ["乌兹别克斯坦守住", 34],
        ["后程拉开", 45]
      ]
    }
  }
];

window.FACTOR_META = {
  strength: "实力边界",
  coach: "教练策略",
  tactics: "战术对位",
  players: "球员状态",
  motivation: "动机赛程",
  market: "市场校验",
  uncertainty: "不确定性"
};

window.TEAM_PROFILES = {
  西班牙: {
    coach: "Luis de la Fuente",
    summary: "控球和边路破局能力强，分析重点是首发边路爆点、肋部渗透和面对低位防守的效率。",
    sourceTier: "FIFA/官方大名单优先，ESPN/FBref 补球员数据。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/164/spain", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  佛得角: {
    coach: "Bubista",
    summary: "弱队面对强队时低位组织和门将表现权重高，需补球员俱乐部分布和防守体系样本。",
    sourceTier: "FIFA/协会官方优先，ESPN/Transfermarkt 补球员俱乐部信息。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/20312/cape-verde", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  伊拉克: {
    coach: "Graham Arnold",
    summary: "重点核验是否采用阶段性高位逼抢，以及这种强度能维持多久。",
    sourceTier: "官方发布会和首发优先，录像样本验证教练策略。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/4592/iraq", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  挪威: {
    coach: "Ståle Solbakken",
    summary: "终结点强，但要单独评估后场出球抗压、首发强度和哈兰德周边支援。",
    sourceTier: "FIFA/协会官方优先，ESPN/FBref 补球员和进攻数据。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/465/norway", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  荷兰: {
    coach: "Ronald Koeman",
    summary: "身体、宽度和定位球能力强，需核验领先后的回收倾向和中场控制质量。",
    sourceTier: "官方首发和发布会优先，比赛录像验证战术对位。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/449/netherlands", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  日本: {
    coach: "Hajime Moriyasu",
    summary: "整体移动、转换和战术纪律强，面对强队时不应按弱队模板处理。",
    sourceTier: "官方大名单、首发和近赛录像优先。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/627/japan", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  葡萄牙: {
    coach: "Roberto Martínez",
    summary: "纸面深度强，前场和边路选择多。正式分析需要补首发强度、轮换倾向和强队大热风险。",
    sourceTier: "FIFA/葡萄牙足协优先，ESPN/FBref 补球员数据。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/482/portugal", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  加纳: {
    coach: "Carlos Queiroz",
    summary: "身体与速度优势明显，但稳定控制力和防线抗压需要核验。",
    sourceTier: "协会官方和 ESPN 优先，Transfermarkt 补球员俱乐部分布。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/4469/ghana", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  巴拿马: {
    coach: "Thomas Christiansen",
    summary: "通常需要关注身体对抗、定位球和低位防守质量。",
    sourceTier: "协会官方和 ESPN 优先，录像验证防守与定位球。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/2659/panama", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  英格兰: {
    coach: "Thomas Tuchel",
    summary: "阵容深度强，分析重点是教练风险偏好、首发搭配和中场控制。",
    sourceTier: "FIFA/英足总优先，ESPN/FBref 补球员数据。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/448/england", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  克罗地亚: {
    coach: "Zlatko Dalić",
    summary: "经验和中场控制是关键，体能与阵容老化需要量化。",
    sourceTier: "官方大名单和比赛录像优先，ESPN 补球员资料。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/477/croatia", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  哥伦比亚: {
    coach: "Néstor Lorenzo",
    summary: "前场个人能力强，需核验首发完整性和边路爆点状态。",
    sourceTier: "协会官方和 ESPN 优先，FBref 补近期球员状态。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/208/colombia", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  },
  乌兹别克斯坦: {
    coach: "Fabio Cannavaro",
    summary: "新军样本需要重点补低位防守、转换质量和大赛经验。",
    sourceTier: "官方大名单和发布会优先，Transfermarkt 补俱乐部分布。",
    links: ["https://www.espn.com/soccer/team/squad/_/id/2570/uzbekistan", "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"]
  }
};
