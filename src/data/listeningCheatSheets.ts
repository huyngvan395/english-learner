export interface ListeningCheatSheet {
  part: 1 | 2 | 3 | 4;
  badge: string;
  title: string;
  coreEssence: string;
  tactics: string[];
  highlightSectionTitle: string;
  highlightItems: { label: string; detail: string }[];
  topTraps: { trap: string; example: string }[];
}

export const LISTENING_CHEAT_SHEETS: Record<1 | 2 | 3 | 4, ListeningCheatSheet> = {
  1: {
    part: 1,
    badge: 'Chiến thuật Part 1 • Photographs',
    title: 'Phân biệt Tranh tả người vs Tranh tả vật & Loại bẫy âm',
    coreEssence:
      'Part 1 kiểm tra khả năng mô tả chính xác trạng thái hiện hữu trong ảnh. Với TRANH TẢ NGƯỜI, tập trung 100% vào động từ hành động chính (V-ing) và vị trí vật đang cầm/chạm. Với TRANH TẢ VẬT / KHÔNG NGƯỜI, loại ngay câu dùng bị động tiếp diễn (is/are being + V3) vì cấu trúc này bắt buộc phải có người đang thực hiện hành động trong khung hình — chỉ chấp nhận bị động trạng thái (is/are + V3 hoặc has/have been + V3).',
    tactics: [
      'Quét ảnh trong 3 giây đầu: Xác định ngay loại tranh (1 người / Nhiều người / Không người) và gọi thầm 2–3 động từ hành động hoặc danh từ nổi bật nhất.',
      'Tranh tả người: So khớp Chủ ngữ + Động từ V-ing (cầm nắm, nhìn, mặc, đứng/ngồi). Phân biệt rõ hành động đang làm (putting on = đang mặc vào) vs trạng thái đã mặc sẵn (wearing = đang mặc).',
      'Tranh không người: Nghe thấy "is/are being + V3" (VD: chairs are being arranged) → LOẠI NGAY LẬP TỨC. Ưu tiên "is/are + V3" hoặc giới từ vị trí (next to, stacked on, lined up along).',
      'Dùng phương pháp loại trừ bằng đầu ngón tay (giữ tay ở đáp án khả nghi nhất), không suy diễn ý định hay bối cảnh ngoài ảnh.',
    ],
    highlightSectionTitle: 'Top 5 cặp bẫy từ gần âm kinh điển hay gặp nhất ở Part 1',
    highlightItems: [
      { label: 'walk / work', detail: 'đi bộ (/wɔːk/) vs làm việc (/wɜːrk/) — bẫy số 1 ở tranh văn phòng & ngoài trời' },
      { label: 'copy / coffee', detail: 'photo, bản sao vs cà phê — dễ nhầm trong tranh bàn làm việc/quán café' },
      { label: 'ladder / letter', detail: 'cái thang vs bức thư — hay bẫy tranh công nhân sửa chữa/giao hàng' },
      { label: 'filing / flying', detail: 'xếp hồ sơ tài liệu vs đang bay — bẫy tranh tủ hồ sơ & sân bay' },
      { label: 'planting / painting', detail: 'trồng cây vs đang sơn/vẽ — hay xuất hiện ở tranh công viên & công trình' },
    ],
    topTraps: [
      {
        trap: 'Bẫy being + V3 ở tranh không người',
        example: 'Ảnh phòng họp trống có ghế xếp gọn, audio đọc "Chairs are being arranged around the table" → SAI vì không có ai đang xếp.',
      },
      {
        trap: 'Bẫy đúng danh từ nhưng sai động từ / tư thế',
        example: 'Ảnh người đàn ông cầm túi đứng cạnh xe, audio đọc "He is putting a bag into the trunk" → SAI động từ vì chưa mở cốp xe.',
      },
      {
        trap: 'Bẫy từ đồng âm / gần âm & nghĩa rộng',
        example: 'Tranh có người đeo kính (glasses) bị lừa thành "pouring water into glasses" (ly nước), hoặc "watching" bị lừa thành "washing".',
      },
    ],
  },
  2: {
    part: 2,
    badge: 'Chiến thuật Part 2 • Question–Response',
    title: 'Nghe 2 từ đầu tiên, Bắt câu trả lời gián tiếp & Loại 3 bẫy kinh điển',
    coreEssence:
      'Part 2 không in đề lên giấy và chỉ đọc 1 lần duy nhất. Chìa khóa đạt 22+/25 câu là khóa chặt 2 TỪ ĐẦU TIÊN (Từ để hỏi Wh- + Trợ động từ/Chủ ngữ) và quen phản xạ với TRẢ LỜI GIÁN TIẾP (Indirect Response — chiếm ~40% từ câu 18–31, không trả lời thẳng mà né sang người khác, báo chưa biết, hoặc hỏi ngược lại).',
    tactics: [
      'Tập trung tối đa 2 từ đầu tiên của câu hỏi: Who (người/chức vụ/phòng ban), When (thời gian/trước-sau sự kiện), Where (địa điểm/giới từ), Why (lý do/to-V/because), How long/much/often (khoảng thời gian/giá/tần suất).',
      'Khi 2 đáp án đầu có vẻ sai hoặc gài bẫy, đáp án còn lại dạng trung lập ("I haven\'t checked yet", "Ask Sarah", "It depends on...") có xác suất đúng lên tới 90%.',
      'Loại ngay đáp án bắt đầu bằng Yes/No nếu câu hỏi là Wh-question hoặc Câu hỏi lựa chọn (A or B).',
      'Với Câu trần thuật (Statement) và Câu hỏi đuôi (Tag), đáp án đúng thường đồng tình, đưa giải pháp hoặc giải thích tiếp mạch hội thoại.',
    ],
    highlightSectionTitle: '4 khuôn mẫu "Trả lời gián tiếp" (Indirect Response) ăn điểm tuyệt đối',
    highlightItems: [
      { label: 'Chưa biết / Để kiểm tra', detail: "I'm not sure / I haven't decided yet / Let me check my schedule / I don't have the details yet." },
      { label: 'Đẩy sang người/nguồn khác', detail: 'You should ask Mr. Kim / HR handles that / Check the memo on the bulletin board.' },
      { label: 'Tùy điều kiện (It depends)', detail: 'It depends on the budget / That depends on how many clients attend.' },
      { label: 'Hỏi ngược / Đưa lý do thực tế', detail: "Wasn't it postponed until Friday? / Actually, the printer is still out of order." },
    ],
    topTraps: [
      {
        trap: 'Bẫy lặp nguyên từ (Same-word Trap)',
        example: 'Q: "Where is the new copy machine?" → A: "I need to copy these contracts." (Lặp từ "copy" nhưng sai trọng tâm nơi chốn → LOẠI).',
      },
      {
        trap: 'Bẫy từ đồng âm / gần âm (Sound-alike)',
        example: 'Q: "Did you write the report?" → A: "Turn right at the corner." (write / right) hoặc "file / fly", "check / desk".',
      },
      {
        trap: 'Bẫy trả lời sai loại câu hỏi / sai thì',
        example: 'Q: "Do you prefer coffee or tea?" → A: "Yes, I do." (Câu hỏi Or không trả lời Yes/No) hoặc hỏi quá khứ "Did you..." nhưng trả lời tương lai sai mạch.',
      },
    ],
  },
  3: {
    part: 3,
    badge: 'Chiến thuật Part 3 • Conversations',
    title: 'Đọc trước 8 giây, Thứ tự trên–dưới, Bắt Paraphrase & Graphic/Hàm ý',
    coreEssence:
      'Mỗi hội thoại Part 3 gồm 3 câu hỏi tuân thủ chặt quy luật TRÌNH TỰ THỜI GIAN từ trên xuống dưới (Câu 1 ở đoạn mở đầu, Câu 2 ở giữa, Câu 3 ở cuối). Điểm 800+ đến từ việc đọc lướt trước 3 câu hỏi trong 8 giây, bắt đúng tín hiệu đổi ý và chuyển đổi Paraphrase giữa lời thoại và đáp án in trên đề.',
    tactics: [
      'Quy tắc 8 giây vàng: Tận dụng lúc băng đọc hướng dẫn hoặc khoảng nghỉ câu trước để đọc sẵn 3 câu hỏi (gạch chân từ khóa: Who / Where / Problem / What does the woman suggest / Next).',
      'Bám đúng thứ tự trên → dưới: Nghe câu 1 ở 2 lượt thoại đầu, câu 2 ở phần thân (chú ý lý do/vấn đề), câu 3 ở 2 lượt cuối (thường là hành động tiếp theo: "I\'ll...", "Why don\'t you...").',
      'Cảnh giác Bẫy đổi ý (Self-correction) & Sai đối tượng (Nam vs Nữ): Nghe kỹ từ khóa đảo chiều "actually / however / wait / originally... but" và tách rõ đề hỏi người Nam hay người Nữ.',
      'Bắt Paraphrase thay vì tìm từ y hệt: Đáp án đúng hiếm khi lặp nguyên văn; hãy quy đổi ý nghĩa (VD: "out of stock" → "unavailable", "revise the schedule" → "change the timetable").',
    ],
    highlightSectionTitle: 'Công thức xử lý 2 dạng câu hỏi phân loại 800+ (Graphic & Implied Meaning)',
    highlightItems: [
      { label: 'Câu hỏi Bảng biểu (Graphic)', detail: 'Đọc trước tiêu đề & các cột trên bảng. Audio sẽ đọc dữ kiện ở Cột A (VD: giá $45 hoặc tầng 3), đáp án đúng nằm ở Cột B tương ứng trên cùng hàng!' },
      { label: 'Câu hỏi Hàm ý (Implied Meaning)', detail: 'Không dịch từng chữ câu trong ngoặc kép — nghe 1 câu TRƯỚC và 1 câu SAU để hiểu ý định thực (từ chối khéo, bày tỏ ngạc nhiên, xác nhận đã xử lý).' },
      { label: 'Hội thoại 3 người (3 Speakers)', detail: 'Chú ý tên riêng được gọi khi chuyển lượt nói ("Thanks, David...") để không nhầm vai trò hay nhiệm vụ của từng người.' },
      { label: 'Tín hiệu hành động tiếp theo', detail: 'Tập trung vào cụm: "I\'ll go ahead and...", "Let me send you...", "Could you look into..." ở 2 câu cuối cùng.' },
    ],
    topTraps: [
      {
        trap: 'Bẫy đúng từ khóa nhưng sai người nói (Nam ↔ Nữ)',
        example: 'Người Nam đề xuất gửi email, người Nữ nhận in tài liệu → Đề hỏi người Nữ sẽ làm gì, bẫy đưa phương án gửi email lên đầu.',
      },
      {
        trap: 'Bẫy đổi ý giữa chừng (Actually / However)',
        example: '"We planned to meet in Room 204, oh wait, it\'s being painted, so let\'s use the lounge." → Đáp án là lounge, Room 204 là bẫy.',
      },
      {
        trap: 'Bẫy đọc đúng chữ trong bảng nhưng sai hàng/điều kiện',
        example: 'Audio nhắc 2 mức gói dịch vụ nhưng chốt chọn gói không vượt ngân sách → Phải đối chiếu điều kiện cuối cùng trên bảng.',
      },
    ],
  },
  4: {
    part: 4,
    badge: 'Chiến thuật Part 4 • Short Talks',
    title: 'Định vị loại bài nói, Bám 3 phần Mở–Thân–Kết, Paraphrase & Bảng biểu',
    coreEssence:
      'Part 4 là bài độc thoại của 1 người nói (Tin nhắn thoại, Thông báo, Quảng cáo, Hướng dẫn tham quan, Giới thiệu diễn giả, Phát biểu cuộc họp). Vì tốc độ đều và ít ngắt nhịp hơn Part 3, bạn phải đọc trước 3 câu hỏi trong 8 giây, chốt ngữ cảnh ở 2 câu đầu và theo sát thứ tự thông tin từ trên xuống dưới.',
    tactics: [
      'Đọc trước 3 câu hỏi trong 8 giây & nhận diện dạng bài nói: Phone Message (lắng nghe lý do gọi + số điện thoại/yêu cầu gọi lại), Announcement (thay đổi lịch/quy định), Advertisement (ưu đãi/điểm nổi bật).',
      'Cấu trúc 3 phần chuẩn ETS: 2 câu đầu trả lời Câu 1 (Người nói là ai / Đang ở đâu / Chủ đề gì) → Đoạn giữa trả lời Câu 2 (Chi tiết sự cố / Thay đổi / Lợi ích) → 2 câu cuối trả lời Câu 3 (Người nghe được yêu cầu làm gì tiếp theo).',
      'Bắt câu mệnh lệnh & đề nghị ở cuối bài cho Câu 3: "Please visit...", "Don\'t forget to...", "Be sure to sign up...", "Call me back at...".',
      'Với câu hỏi Bảng biểu (Graphic) & Hàm ý (Implied Meaning): Liên kết dữ kiện âm thanh với cột còn lại trên bảng, và dựa vào giọng điệu/ngữ cảnh ngay trước câu trích dẫn.',
    ],
    highlightSectionTitle: 'Dấu hiệu nhận diện nhanh 6 thể loại bài nói Part 4',
    highlightItems: [
      { label: 'Tin nhắn thoại (Phone Message)', detail: 'Mở đầu: "Hi, this is... calling from... about..." → Chốt lý do gọi & hành động người nhận cần làm.' },
      { label: 'Thông báo (Announcement)', detail: 'Mở đầu: "Attention shoppers / passengers / staff..." → Bắt sự cố, thay đổi giờ/cổng & hướng dẫn thay thế.' },
      { label: 'Quảng cáo (Advertisement)', detail: 'Mở đầu: "Are you tired of...? / Introducing..." → Bắt sản phẩm, điểm khác biệt & khuyến mãi giới hạn thời gian.' },
      { label: 'Họp / Giới thiệu / Tham quan', detail: 'Mở đầu: "Welcome everyone / Let\'s begin today\'s meeting / On your left..." → Bắt mục đích, thành tích diễn giả & điểm dừng kế tiếp.' },
    ],
    topTraps: [
      {
        trap: 'Bẫy thông tin cũ bị thay thế bởi thông báo mới',
        example: '"Normally the shuttle departs every 30 minutes, but today due to construction it leaves every 45 minutes." → Bẫy ghi 30 minutes.',
      },
      {
        trap: 'Bẫy Paraphrase chức danh & địa điểm',
        example: 'Audio nói "check-in counter, boarding pass, gate B12" nhưng không nói chữ "airport" → Đáp án là "At an airport" hoặc "Airline representative".',
      },
      {
        trap: 'Bẫy đối tượng hưởng ưu đãi / ngoại lệ trong Graphic',
        example: 'Bảng có 4 khung giờ hoặc 4 mức giá, audio nhắc tới điều kiện "before Friday" hoặc "for members only" để loại 3 dòng còn lại.',
      },
    ],
  },
};
