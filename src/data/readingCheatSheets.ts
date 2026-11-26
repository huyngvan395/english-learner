export interface ReadingCheatSheet {
  id: string;
  title: string;
  badge: string;
  coreEssence: string;
  fiveSecondFormulas: string[];
  topTraps: {
    trap: string;
    example: string;
  }[];
}

export const PART5_TOPIC_CHEAT_SHEETS: Record<string, ReadingCheatSheet> = {
  'Từ loại (Word Form)': {
    id: 'word-form',
    title: 'Từ loại (Word Form — Danh / Động / Tính / Trạng)',
    badge: 'Part 5 • Ăn điểm 5 giây',
    coreEssence:
      'Tiếng Anh đặt từ theo trật tự chức năng cố định trong cụm từ (mạo từ/sở hữu → trạng từ → tính từ → danh từ). Khi 4 đáp án cùng gốc từ khác hậu tố, bạn KHÔNG cần dịch cả câu — chỉ cần nhìn từ ngay trước và ngay sau chỗ trống để xác định vị trí còn thiếu.',
    fiveSecondFormulas: [
      'a / an / the / tính từ sở hữu (our, its) + [Adv] + [Adj] + N (+ giới từ/động từ)',
      'be / become / remain / seem / make + O + Adj (tính từ bổ nghĩa cho chủ ngữ/tân ngữ)',
      'Đứng đầu câu trước dấu phẩy, hoặc kẹp giữa trợ động từ (has/is/will) và V3/V-ing → chọn Trạng từ (-ly)',
      'Sau giới từ (of, for, by, with, in) + [chỗ trống] + tân ngữ → V-ing; nếu không có tân ngữ phía sau → Danh từ',
    ],
    topTraps: [
      {
        trap: 'Bẫy Danh từ ghép (Noun + Noun): thấy danh từ phía sau liền chọn Tính từ mà quên danh từ ghép cố định.',
        example: 'safety regulations (quy định an toàn), customer satisfaction, performance evaluation — đều là N + N.',
      },
      {
        trap: 'Bẫy đuôi giống nhau (-al, -ive, -ly): nhiều danh từ có đuôi -al (approval, proposal, renewal) và tính từ có đuôi -ly (costly, timely, friendly).',
        example: 'The manager gave final approval (N), NOT approve/approving; a timely delivery (Adj), NOT time.',
      },
      {
        trap: 'Bẫy động từ nối (linking verbs) + Adj thay vì Adv: sau remain / stay / seem / find + O phải dùng Tính từ.',
        example: 'The new software made the workflow remarkably efficient (Adv + Adj), KHÔNG chọn efficiently.',
      },
    ],
  },

  'Thì & Hòa hợp chủ vị': {
    id: 'tenses-sva',
    title: 'Thì động từ & Hòa hợp Chủ – Vị (Tenses & SVA)',
    badge: 'Part 5 • Trụ cột ngữ pháp',
    coreEssence:
      'Động từ chính trong câu tiếng Anh buộc phải khớp với 2 trục: (1) Mốc thời gian của hành động (quá khứ / hiện tại / tương lai / hoàn thành) và (2) Số ít hay số nhiều của CHỦ NGỮ CHÍNH (loại bỏ toàn bộ cụm giới từ chen giữa).',
    fiveSecondFormulas: [
      'by + mốc tương lai (by next Friday) → Tương lai hoàn thành (will have + V3/ed)',
      'since + mốc quá khứ / over the past 5 years / recently / already → Hiện tại hoàn thành (has/have + V3/ed)',
      'Chủ ngữ cụm giới từ "N1 + of/with/in + N2" → chia động từ theo N1 (The list of applicants IS...)',
      'Each / Every / Neither / Either / One of + N số nhiều → luôn chia động từ SỐ ÍT; A number of + N nhiều → số nhiều, The number of + N nhiều → số ít',
    ],
    topTraps: [
      {
        trap: 'Bẫy danh từ gần động từ nhất: ETS nhét cụm giới từ dài (of + N số nhiều) ngay trước chỗ trống để dụ chia số nhiều.',
        example: 'The shipment of electronic components WAS delayed (chủ ngữ chính là "The shipment" — số ít).',
      },
      {
        trap: 'Bẫy mệnh đề thời gian/điều kiện (when, once, before, as soon as, until, if): KHÔNG dùng "will" bên trong mệnh đề phụ này.',
        example: 'Once the inspector approves (KHÔNG dùng will approve) the blueprint, construction will begin.',
      },
      {
        trap: 'Bẫy "by the time + QKĐ" vs "by the time + HTĐ": vế chính phải lùi/đẩy về thì Hoàn thành tương ứng.',
        example: 'By the time the CEO arrived, the committee had already finalized the budget.',
      },
    ],
  },

  'Thể bị động (Passive Voice)': {
    id: 'passive-voice',
    title: 'Thể bị động (Passive Voice — be + V3/ed)',
    badge: 'Part 5 • Siêu phổ biến ETS',
    coreEssence:
      'Chủ ngữ là vật/sự việc không tự thực hiện hành động, hoặc phía sau ngoại động từ KHÔNG có tân ngữ trực tiếp (O) đứng ngay sau chỗ trống → câu bắt buộc phải chia ở thể bị động (be + V3/ed).',
    fiveSecondFormulas: [
      'Ngoại động từ + KHÔNG có Tân ngữ (theo sau là giới từ by/in/at/to hoặc dấu câu) → chọn Bị động (be + V3/ed)',
      'Ngoại động từ + CÓ Tân ngữ ngay sau (a/an/the/N) → chọn Chủ động (trừ động từ 2 tân ngữ: give, offer, award, send, grant)',
      'Cấu trúc cầu khiến: have/get + vật + V3/ed (nhờ ai làm gì cho vật đó)',
    ],
    topTraps: [
      {
        trap: 'Bẫy Nội động từ (không bao giờ chia bị động): happen, occur, rise, arrive, exist, remain, consist of, expire.',
        example: 'The warranty expired last month (KHÔNG BAO GIỜ viết "was expired").',
      },
      {
        trap: 'Bẫy động từ 2 tân ngữ (award, offer, give, grant, assign): dù phía sau vẫn còn 1 danh từ, câu vẫn có thể là BỊ ĐỘNG.',
        example: 'Ms. Park was awarded a prestigious grant (được trao một khoản tài trợ — vẫn có tân ngữ sau bị động).',
      },
      {
        trap: 'Bẫy "be + V-ing" vs "be + V3/ed": thấy "is/are" phía trước đừng chọn bừa — nhìn ngay sau chỗ trống xem có tân ngữ hay giới từ.',
        example: 'The lobby is currently being renovated (sau chỗ trống hết câu, không có O → bị động tiếp diễn).',
      },
    ],
  },

  'Phân từ / V-ing / To-V': {
    id: 'participles-gerunds',
    title: 'Phân từ, Danh động từ & Động từ nguyên mẫu (V-ing / V-ed / To-V)',
    badge: 'Part 5 • Bẫy 700–850+',
    coreEssence:
      'Một câu đơn chỉ có 1 động từ chia thì chính. Mọi động từ xuất hiện thêm (để làm tân ngữ, chỉ mục đích, hoặc bổ nghĩa cho danh từ) phải biến thành dạng phi vị ngữ: To-V (mục đích/dự định), V-ing (chủ động/danh động từ), hoặc V-ed/V3 (bị động).',
    fiveSecondFormulas: [
      'Đầu câu "_____ + O, S + V": chỉ mục đích ("để làm gì") → To-V; diễn tả hành động đồng thời chủ động → V-ing; bị động → V3/ed',
      'Sau giới từ (by, for, without, upon, in addition to, look forward to, be committed to) → BẮT BUỘC dùng V-ing / N',
      'Động từ + V-ing: consider, recommend, suggest, avoid, postpone, finish, discontinue, appreciate',
      'Động từ + To-V: decide, plan, expect, promise, offer, afford, fail, agree, manage, strive, attempt',
    ],
    topTraps: [
      {
        trap: 'Bẫy "to" là giới từ (KHÔNG phải To-V): look forward to, be dedicated/committed/devoted to, contribute to, object to, prior to + V-ing.',
        example: 'We are committed to delivering (KHÔNG dùng deliver) eco-friendly packaging.',
      },
      {
        trap: 'Bẫy Tính từ phân từ chỉ cảm xúc/tính chất: V-ing mô tả bản chất sự vật (challenging, promising, demanding); V-ed mô tả cảm xúc/trạng thái người/vật bị tác động (satisfied, attached, updated).',
        example: 'Please review the attached (được đính kèm) invoice — KHÔNG chọn attaching.',
      },
      {
        trap: 'Bẫy chủ ngữ đồng nhất ở mệnh đề phân từ đầu câu: chủ ngữ đứng sau dấu phẩy chính là chủ thể thực hiện/chịu tác động của V-ing/V-ed đầu câu.',
        example: 'Designed by a local architect, the museum attracts... (bảo tàng ĐƯỢC thiết kế → V3/ed).',
      },
    ],
  },

  'Mệnh đề quan hệ & Rút gọn': {
    id: 'relative-clauses',
    title: 'Mệnh đề quan hệ & Rút gọn mệnh đề quan hệ',
    badge: 'Part 5 • Ăn điểm 750–900',
    coreEssence:
      'Mệnh đề quan hệ bổ sung thông tin cho danh từ đứng ngay trước nó. Bạn cần xác định 2 việc: (1) Danh từ phía trước là Người hay Vật & chỗ trống làm Chủ ngữ, Tân ngữ hay Sở hữu; (2) Nếu rút gọn đại từ quan hệ, chủ động dùng V-ing, bị động dùng V3/ed.',
    fiveSecondFormulas: [
      'Người + who + V | Người + whom + S + V | Vật + which + V / S + V',
      'N1 + whose + N2 (danh từ sở hữu thuộc về N1 — áp dụng cho cả người và vật)',
      'Giới từ + which / whom (KHÔNG BAO GIỜ dùng giới từ + that / who); sau dấu phẩy "," KHÔNG dùng "that"',
      'Rút gọn MĐQH: N + V-ing (chủ động, thường có O theo sau) | N + V3/ed (bị động, thường theo sau bởi giới từ by/in/for)',
    ],
    topTraps: [
      {
        trap: 'Bẫy câu đã có động từ chính ở cuối: học viên thấy N + [chỗ trống] liền chia động từ chính (thêm 2 động từ chính không có liên từ → sai ngữ pháp).',
        example: 'All applications submitted (rút gọn của "which are submitted") after May 10 will not be reviewed.',
      },
      {
        trap: 'Bẫy "what" vs "that/which": "what" = "the thing that", KHÔNG BAO GIỜ có danh từ đứng ngay trước nó.',
        example: 'We appreciate what you accomplished (trước không có N) ≠ the report that/which you submitted.',
      },
      {
        trap: 'Bẫy "where" vs "which" với địa điểm: nếu mệnh đề sau ĐỦ S + V + O (không thiếu tân ngữ) → dùng where; nếu THIẾU chủ ngữ hoặc tân ngữ → dùng which.',
        example: 'The branch that/which opened last year (thiếu S) ≠ The branch where we held the workshop (đủ S+V+O).',
      },
    ],
  },

  'Liên từ & Giới từ': {
    id: 'conjunctions-prepositions',
    title: 'Liên từ & Giới từ (Conjunctions vs Prepositions)',
    badge: 'Part 5 • Bẫy kinh điển nhất TOEIC',
    coreEssence:
      'Mọi câu dạng này đều tách làm 2 bước: Bước 1 nhìn CẤU TRÚC phía sau chỗ trống là Mệnh đề (S + V) hay Cụm danh từ (N/V-ing) để loại ngay 2 đáp án sai loại từ; Bước 2 dịch quan hệ logic (Nhượng bộ / Nguyên nhân / Thời gian / Điều kiện) để chốt 1 đáp án.',
    fiveSecondFormulas: [
      'LIÊN TỪ + S + V: although / even though / whereas (tương phản) • because / since / now that (nguyên nhân) • while (trong khi) • unless / provided that (điều kiện)',
      'GIỚI TỪ + N / V-ing: despite / in spite of (mặc dù) • because of / due to / owing to (bởi vì) • during / throughout (trong suốt) • prior to / following / regarding',
      'TRẠNG TỪ NỐI (đứng giữa dấu chấm/chấm phẩy và dấu phẩy): However, / Therefore, / Nevertheless, / Moreover, / Consequently,',
      'Cặp liên từ tương quan: both A and B • either A or B • neither A nor B • not only A but also B • between A and B',
    ],
    topTraps: [
      {
        trap: 'Bẫy "Despite / Because of / During" + Mệnh đề: nhìn thấy nghĩa tiếng Việt đúng ("mặc dù/bởi vì") nhưng sau chỗ trống là S + V nên KHÔNG được chọn giới từ.',
        example: 'Although sales declined (S+V) ≠ Despite the decline in sales (Cụm danh từ).',
      },
      {
        trap: 'Bẫy "However / Therefore" nối 2 mệnh đề chỉ bằng 1 dấu phẩy: Trạng từ nối KHÔNG có chức năng nối mệnh đề như Liên từ.',
        example: 'The budget was tight; however, the team finished on time (cần dấu ";" hoặc "." trước however).',
      },
      {
        trap: 'Bẫy "while / once / unless" rút gọn chủ ngữ (Liên từ + V-ing / V3 / Adj): khi 2 vế cùng chủ ngữ, liên từ vẫn đứng trước V-ing/V3 được!',
        example: 'While reviewing the contract, Mr. Lim noticed a typo (= While he was reviewing...).',
      },
    ],
  },

  'Câu điều kiện & So sánh': {
    id: 'conditionals-comparisons',
    title: 'Câu điều kiện, Đảo ngữ & Cấu trúc So sánh',
    badge: 'Part 5 • Chốt điểm 800–950',
    coreEssence:
      'ETS cực kỳ chuộng đảo ngữ câu điều kiện (bỏ "if", đảo Should / Were / Had lên đầu câu) và các cấp độ nhấn mạnh trong câu so sánh (much/far/significantly + so sánh hơn; so sánh càng... càng...).',
    fiveSecondFormulas: [
      'Đảo ngữ ĐK loại 1: Should + S + V(nguyên mẫu), S + will/can/please V... (= If S should V...)',
      'Đảo ngữ ĐK loại 2: Were + S + to-V / N / Adj, S + would V... | Đảo ngữ ĐK loại 3: Had + S + V3/ed, S + would have V3/ed',
      'Nhấn mạnh so sánh hơn: much / far / significantly / substantially / even + Adj-er / more Adj + than',
      'So sánh bằng: as + Adj/Adv + as | So sánh nhất: the + most/est + (in/of/ever + HTHT)',
    ],
    topTraps: [
      {
        trap: 'Bẫy "Should" ở đầu câu không có dấu chấm hỏi: rất nhiều người tưởng câu hỏi nhưng thực ra đó là Đảo ngữ If loại 1 ("Nếu...").',
        example: 'Should you have any inquiries, please contact our support desk (= If you have any inquiries...).',
      },
      {
        trap: 'Bẫy dùng "very" trước so sánh hơn: "very" chỉ đi với tính từ gốc, muốn nhấn mạnh so sánh hơn phải dùng much / far / considerably.',
        example: 'The upgraded server is significantly faster than the previous model (KHÔNG dùng very faster).',
      },
      {
        trap: 'Bẫy thiếu từ so sánh đối ứng "than" vs "as": thấy "than" → loại so sánh bằng & nhất; thấy "the" + phạm vi "in the region / of all" → chọn so sánh nhất.',
        example: 'This quarter generated the highest revenue in the company’s history.',
      },
    ],
  },

  'Đại từ, Từ hạn định & Lượng từ': {
    id: 'pronouns-quantifiers',
    title: 'Đại từ, Từ hạn định & Lượng từ (Pronouns, Determiners & Quantifiers)',
    badge: 'Part 5 • Cực dễ mất điểm oan',
    coreEssence:
      'Đại từ và từ hạn định thay thế hoặc giới hạn danh từ đã nhắc tới trước đó. Bạn cần xác định 3 trục: (1) Vai trò trong câu (Chủ ngữ / Tân ngữ / Tính từ sở hữu + N / Đại từ sở hữu đứng một mình / Đại từ phản thân nhấn mạnh); (2) Danh từ đếm được số ít, số nhiều hay không đếm được; (3) Có "of + the/tính từ sở hữu" hay không.',
    fiveSecondFormulas: [
      'Tính từ sở hữu (his/her/its/their) + N ≠ Đại từ sở hữu (his/hers/theirs) đứng ĐỘC LẬP không có N theo sau',
      'Đại từ phản thân (-self/-selves): khi Chủ ngữ = Tân ngữ, hoặc đặt cuối câu / sau "by" mang nghĩa "tự mình / một mình" (by themselves)',
      'another + N đếm được số ít | other + N số nhiều/không đếm được | others = other + N số nhiều (đứng một mình)',
      'each / every + N số ít | most + N số nhiều ≠ most OF + the/these/our + N số nhiều | a few / many + N đếm được ≠ a little / much + N không đếm được',
    ],
    topTraps: [
      {
        trap: 'Bẫy "most of + N" thiếu từ hạn định: giữa "most of / all of / some of / each of" và danh từ BẮT BUỘC phải có the / these / our / tân ngữ đại từ.',
        example: 'Most employees (KHÔNG có of) ≠ Most of the employees (có of + the).',
      },
      {
        trap: 'Bẫy "another" vs "other" vs "others": thấy danh từ số nhiều đứng sau chỗ trống tuyệt đối không chọn "another" hay "others".',
        example: 'We need to consider other options (N số nhiều) ≠ another option (N số ít) ≠ Some agreed, while others disagreed.',
      },
      {
        trap: 'Bẫy dùng đại từ tân ngữ thay đại từ phản thân khi chủ ngữ và tân ngữ là cùng một đối tượng.',
        example: 'The director herself reviewed the final draft / Guests may register themselves online.',
      },
    ],
  },

  'Từ vựng & Collocations công sở': {
    id: 'vocab-collocations',
    title: 'Từ vựng & Collocations công sở (Business Context)',
    badge: 'Part 5 • Phân hóa 850+',
    coreEssence:
      'Khi 4 đáp án cùng từ loại nhưng khác nghĩa hoàn toàn, đừng chỉ dịch nghĩa đen rời rạc — hãy tìm cụm từ đi cố định (Collocation: động từ đi với danh từ nào, giới từ đi kèm phía sau là gì) và manh mối ngữ cảnh trước/sau chỗ trống.',
    fiveSecondFormulas: [
      'Nhìn giới từ ngay sau chỗ trống để chốt Collocation: comply WITH, eligible FOR, subject TO, in accordance WITH, responsible FOR, refrain FROM',
      'Nhìn cặp Động từ + Danh từ quen thuộc: meet a deadline, launch a campaign, conduct a survey, issue a refund, submit a reimbursement claim',
      'Đọc manh mối logic trong cùng câu (từ đối lập, nguyên nhân–kết quả) để xác định sắc thái Tích cực hay Tiêu cực của từ cần điền',
    ],
    topTraps: [
      {
        trap: 'Bẫy từ gần nghĩa nhưng sai ngữ cảnh công sở (confusable words): complimentary (miễn phí) ≠ complementary (bổ sung); stationary (đứng yên) ≠ stationery (văn phòng phẩm).',
        example: 'Guests receive complimentary breakfast (bữa sáng miễn phí) upon check-in.',
      },
      {
        trap: 'Bẫy dịch word-by-word tiếng Việt: ví dụ "giữ lời hứa / đáp ứng hạn chót" trong TOEIC dùng "meet/observe a deadline", KHÔNG dùng "catch/reach".',
        example: 'All contractors must adhere strictly to the revised safety guidelines.',
      },
      {
        trap: 'Bẫy từ đa nghĩa công sở: "address" (giải quyết vấn đề), "reserve" (đặt chỗ), "conduct" (tiến hành), "cover" (chi trả/bao gồm), "promptly" (ngay lập tức).',
        example: 'The HR director promptly addressed employees’ concerns about the new shift policy.',
      },
    ],
  },
};

export const PART6_STRATEGY_CHEAT_SHEET: ReadingCheatSheet = {
  id: 'part6-strategy',
  title: 'Chiến thuật giải Part 6 & Quy trình xử lý câu Điền cả câu (Sentence Insertion)',
  badge: 'Part 6 • Mạch văn & Từ quy chiếu',
  coreEssence:
    'Khác với Part 5 chỉ cần đọc 1 câu, Part 6 kiểm tra tính liên kết xuyên đoạn (cohesion). Đặc biệt ở dạng Điền cả câu (4 câu mỗi đề), đáp án đúng LUÔN có sợi dây liên kết chặt chẽ với câu đứng NGAY TRƯỚC và câu đứng NGAY SAU chỗ trống thông qua từ quy chiếu và thì động từ.',
  fiveSecondFormulas: [
    'Bước 1 — Đọc tiêu đề & Header (From / To / Subject) trong 5 giây để nắm ngay mục đích văn bản (Email thông báo / Quảng cáo / Khiếu nại).',
    'Bước 2 — Với câu Từ loại / Ngữ pháp: xử lý nhanh trong câu chứa chỗ trống như Part 5 (nhớ kiểm tra THÌ của cả đoạn văn xung quanh).',
    'Bước 3 — Với câu Điền cả câu: khoanh tròn TỪ QUY CHIẾU ở câu ngay sau (this/these/such/it/they/that policy) và ở các đáp án (However, In addition, As a result, For this reason).',
    'Bước 4 — Loại ngay đáp án lạc chủ đề hoặc lặp lại nguyên ý câu trước mà không bắc cầu sang câu sau.',
  ],
  topTraps: [
    {
      trap: 'Bẫy "đọc hay nhưng đứt mạch câu sau": đáp án hợp với câu trước nhưng làm đại từ "they / this change" ở câu sau trở nên vô nghĩa.',
      example: 'Câu sau: "These upgrades will take effect on Monday." → Câu điền vào BẮT BUỘC phải nhắc tới số nhiều các nâng cấp/thay đổi.',
    },
    {
      trap: 'Bẫy chọn thì động từ theo cảm tính mà bỏ qua mốc thời gian đầu đoạn văn (thư tường thuật sự kiện đã qua vs thông báo sự kiện sắp tới).',
      example: 'Đầu thư viết "Last week we hosted..." → chỗ trống giữa đoạn phải chia Quá khứ đơn, không chọn Hiện tại/Tương lai.',
    },
    {
      trap: 'Bẫy từ nối ngược chiều (However / Therefore / Meanwhile): chọn nhầm khi chỉ đọc câu sau mà không đối chiếu sắc thái (+/-) của câu trước.',
      example: 'Trước: "Chi phí tăng mạnh." — Sau: "Chúng tôi vẫn giữ nguyên giá bán." → Phải chọn Nevertheless / However.',
    },
  ],
};

export const PART7_STRATEGY_CHEAT_SHEET: ReadingCheatSheet = {
  id: 'part7-strategy',
  title: 'Chiến thuật đọc hiểu Part 7 — Scanning, Paraphrase & Liên kết Double/Triple Passage',
  badge: 'Part 7 • Làm chủ 54 câu đọc hiểu',
  coreEssence:
    'Đáp án đúng trong Part 7 hầu như KHÔNG BAO GIỜ chép y nguyên từ trong bài đọc — ETS luôn diễn đạt lại bằng từ đồng nghĩa hoặc cấu trúc tương đương (Paraphrase). Ở Double/Triple Passage, luôn có 1–2 câu "liên kết chéo" buộc bạn ghép 1 dữ kiện ở Văn bản 1 với 1 dữ kiện ở Văn bản 2/3.',
  fiveSecondFormulas: [
    'Bước 1 (Skimming 10 giây): Đọc dòng tiêu đề + loại văn bản (Email / Schedule / Invoice / Chat) để định vị cấu trúc thông tin trước khi đọc câu hỏi.',
    'Bước 2 (Scanning theo thứ tự): Câu hỏi Part 7 thường đi theo TRẬT TỰ TỪ TRÊN XUỐNG DƯỚI trong văn bản — câu Ý chính làm sau cùng nếu chưa chắc.',
    'Bước 3 (Ghép mảnh Double/Triple Passage): Tìm "điểm neo chung" (tên riêng, mã đơn hàng, ngày giờ, mức giá, chức danh) xuất hiện ở cả Văn bản 1 và Văn bản 2 để suy ra đáp án.',
    'Bước 4 (Câu loại trừ NOT/TRUE): Tìm 3 phương án CÓ xuất hiện trong bài (dưới dạng Paraphrase) để gạch bỏ, phương án còn lại là đáp án đúng.',
  ],
  topTraps: [
    {
      trap: 'Bẫy lặp từ nguyên văn (Word-matching trap): đáp án chép lại y hệt từ khóa trong bài đọc nhưng cố tình đổi chủ thể, ngày giờ hoặc phủ định ý.',
      example: 'Bài viết: "Discount applies only to orders placed before Friday." → Đáp án bẫy: "Orders placed on Friday receive a discount."',
    },
    {
      trap: 'Bẫy câu hỏi hàm ý trong chuỗi tin nhắn Chat ("What does X mean when writing \'...\'?"): phải đọc 1–2 tin nhắn NGAY TRƯỚC và NGAY SAU câu trích dẫn mới hiểu đúng hàm ý.',
      example: '"I’m on it!" sau lời nhờ kiểm tra tồn kho = "She will check the inventory right away."',
    },
    {
      trap: 'Bẫy chỉ đọc 1 văn bản ở Double/Triple Passage: câu hỏi nhắc tên 1 nhân vật ở Văn bản 2 nhưng điều kiện áp dụng/mức phí lại nằm trong bảng ở Văn bản 1.',
      example: 'Đoạn 2 nói khách chọn gói "Standard" + Đoạn 1 ghi bảng giá gói Standard = $45 → Đáp án là $45.',
    },
  ],
};

export function findPart5CheatSheet(topic: string): ReadingCheatSheet | null {
  if (!topic || topic === 'Tất cả') return null;
  if (PART5_TOPIC_CHEAT_SHEETS[topic]) return PART5_TOPIC_CHEAT_SHEETS[topic];
  const low = topic.toLowerCase();
  if (low.includes('từ loại') || low.includes('word form')) return PART5_TOPIC_CHEAT_SHEETS['Từ loại (Word Form)'];
  if (low.includes('thì') || low.includes('hòa hợp') || low.includes('tense')) return PART5_TOPIC_CHEAT_SHEETS['Thì & Hòa hợp chủ vị'];
  if (low.includes('bị động') || low.includes('passive')) return PART5_TOPIC_CHEAT_SHEETS['Thể bị động (Passive Voice)'];
  if (low.includes('phân từ') || low.includes('v-ing') || low.includes('to-v')) return PART5_TOPIC_CHEAT_SHEETS['Phân từ / V-ing / To-V'];
  if (low.includes('đại từ') || low.includes('hạn định') || low.includes('lượng từ') || low.includes('pronoun') || low.includes('quantifier'))
    return PART5_TOPIC_CHEAT_SHEETS['Đại từ, Từ hạn định & Lượng từ'];
  if (low.includes('quan hệ') || low.includes('relative')) return PART5_TOPIC_CHEAT_SHEETS['Mệnh đề quan hệ & Rút gọn'];
  if (low.includes('liên từ') || low.includes('giới từ') || low.includes('conjunction') || low.includes('preposition'))
    return PART5_TOPIC_CHEAT_SHEETS['Liên từ & Giới từ'];
  if (low.includes('điều kiện') || low.includes('so sánh') || low.includes('đảo ngữ')) return PART5_TOPIC_CHEAT_SHEETS['Câu điều kiện & So sánh'];
  return PART5_TOPIC_CHEAT_SHEETS['Từ vựng & Collocations công sở'];
}
