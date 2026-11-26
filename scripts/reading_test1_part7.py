# -*- coding: utf-8 -*-
"""
ETS Reading Test #1 — Part 7 Bank (5 full passage sets = 23 questions):
1. Single Passage #1: Text Message Chain (Trade Show Logistics — 4 Qs)
2. Single Passage #2: Company Memo & Maintenance Schedule (IT Cloud Migration — 4 Qs incl. [1][2][3][4])
3. Double Passage #1: Job Posting + Applicant Email (Supply Chain Analyst — 5 Qs incl. [1][2][3][4])
4. Double Passage #2: FinTech Summit Schedule + Attendee Feedback Email (5 Qs)
5. Triple Passage #1: Policy Notice + Commercial Invoice + Customer Email (5 Qs)
"""

PART7_TEST1_SETS = [
    # SET 1: SINGLE PASSAGE (TEXT MESSAGE CHAIN)
    {
        "id": "t1-p7-single-1",
        "title": "Single 1: Chuỗi tin nhắn điều phối Triển lãm Mùa thu",
        "passageCountType": "single",
        "topic": "Sự kiện & Văn phòng (Text Message Chain)",
        "passages": [
            {
                "id": "p7-s1-doc1",
                "tabLabel": "Text Message Chain",
                "genre": "Text Message Chain",
                "title": "Nhóm Chat: Autumn Trade Show Logistics",
                "headerMeta": [
                    {"label": "Thành viên", "value": "Hannah Ortiz (Event Lead), Marcus Reid (Logistics), Priya Nair (Design)"},
                    {"label": "Ngày", "value": "Wednesday, September 18"},
                ],
                "chatMessages": [
                    {"id": "p7-s1-m1", "sender": "Hannah Ortiz", "time": "9:12 A.M.", "align": "left",
                     "en": "Good morning everyone! Quick check-in before tomorrow’s exhibition at Metro Hall. Did the printed product catalogs arrive at the booth yet?",
                     "vi": "Chào buổi sáng cả nhà! Kiểm tra nhanh trước triển lãm ngày mai tại Metro Hall. Các cuốn danh mục sản phẩm in ấn đã tới gian hàng chưa?"},
                    {"id": "p7-s1-m2", "sender": "Marcus Reid", "time": "9:15 A.M.", "align": "right",
                     "en": "Just got off the phone with Apex Printing. Their delivery van had a flat tire on Route 9, so the boxes won’t reach Metro Hall until around 2:30 P.M.",
                     "vi": "Tôi vừa gọi xong với Apex Printing. Xe tải giao hàng của họ bị xẹp lốp trên đường số 9, nên các thùng hàng sẽ không đến Metro Hall cho tới khoảng 2:30 chiều."},
                    {"id": "p7-s1-m3", "sender": "Priya Nair", "time": "9:17 A.M.", "align": "left",
                     "en": "That’s tight, since booth setup closes at 4:00 P.M. Meanwhile, I noticed a pricing typo on the digital banner we uploaded for the display screen.",
                     "vi": "Khá gấp đấy, vì khu gian hàng đóng cửa phần dàn dựng lúc 4:00 chiều. Trong lúc đó, tôi vừa phát hiện một lỗi đánh máy giá trên banner kỹ thuật số chúng ta tải lên màn hình."},
                    {"id": "p7-s1-m4", "sender": "Hannah Ortiz", "time": "9:19 A.M.", "align": "left",
                     "en": "Good catch, Priya! Can you fix the banner file right away? Marcus, I’m stuck in a budget review until 1:00 P.M., so could you stay at the venue to sign for the catalogs?",
                     "vi": "Phát hiện kịp thời quá Priya! Bạn sửa ngay file banner nhé? Marcus ơi, tôi kẹt họp duyệt ngân sách tới 1:00 chiều, bạn ở lại địa điểm ký nhận catalog giúp tôi được không?"},
                    {"id": "p7-s1-m5", "sender": "Marcus Reid", "time": "9:21 A.M.", "align": "right",
                     "en": "Consider it done. I’ll also set up the tabletop monitors while I wait.",
                     "vi": "Cứ coi như xong rồi nhé. Tôi cũng sẽ lắp đặt các màn hình để bàn trong lúc chờ."},
                    {"id": "p7-s1-m6", "sender": "Priya Nair", "time": "9:23 A.M.", "align": "left",
                     "en": "Already exporting the corrected graphic. I’ll drop the USB drive off with Marcus before noon.",
                     "vi": "Tôi đang xuất file đồ họa đã sửa rồi. Tôi sẽ mang ổ USB sang đưa cho Marcus trước buổi trưa."},
                ],
                "paragraphs": [],
            }
        ],
        "questions": [
            {
                "id": "p7-s1-q1", "questionNumber": 147, "questionType": "Ý chính (Main Idea)",
                "prompt": "Why are the speakers messaging each other?",
                "options": {
                    "A": "To negotiate a discount with a printing vendor",
                    "B": "To coordinate preparations for an upcoming trade show",
                    "C": "To reschedule a quarterly budget review meeting",
                    "D": "To reserve a larger exhibition booth at Metro Hall",
                },
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Ý chính (Main Idea)", "signal": "Đọc tin nhắn mở đầu lúc 9:12 A.M. của Hannah."},
                    "translation": {"questionVi": "Tại sao nhóm này nhắn tin cho nhau?", "optionsVi": {"A": "Đàm phán giảm giá với nhà in", "B": "Điều phối công tác chuẩn bị cho hội chợ thương mại sắp tới", "C": "Đổi lịch họp ngân sách", "D": "Đặt gian hàng lớn hơn"}},
                    "proof": {"explanation": "Hannah mở đầu kiểm tra trước 'tomorrow’s exhibition' và cả nhóm phối hợp nhận catalog, sửa banner, lắp màn hình.", "evidenceQuote": "Quick check-in before tomorrow’s exhibition at Metro Hall.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s1-m1"},
                    "wrongOptionsAnalysis": {"A": "Loại — Không có đàm phán giảm giá.", "B": "ĐÚNG — exhibition = trade show.", "C": "Loại — Họp ngân sách chỉ là lý do Hannah bận.", "D": "Loại — Không nhắc đổi kích cỡ gian hàng."},
                    "keyTakeaways": {"formula": "Main Idea của Chat luôn nằm ở 1–2 tin nhắn đầu tiên.", "commonTrap": "Bẫy lặp từ 'printing', 'budget review', 'Metro Hall'.", "paraphrases": [{"textInPassage": "tomorrow’s exhibition", "textInAnswer": "upcoming trade show", "meaningVi": "triển lãm sắp diễn ra"}]},
                },
            },
            {
                "id": "p7-s1-q2", "questionNumber": 148, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "Why will the product catalogs arrive later than expected?",
                "options": {
                    "A": "The printer had to fix a typo on the cover.",
                    "B": "The exhibition hall closes early on Wednesdays.",
                    "C": "The delivery vehicle experienced a mechanical problem.",
                    "D": "The order was sent to the wrong venue by mistake.",
                },
                "correctAnswer": "C",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết + Paraphrase", "signal": "Tìm lý do giao trễ trong tin nhắn 9:15 A.M. của Marcus."},
                    "translation": {"questionVi": "Tại sao danh mục sản phẩm đến muộn hơn dự kiến?", "optionsVi": {"A": "Nhà in sửa lỗi đánh máy bìa", "B": "Hội trường đóng cửa sớm", "C": "Phương tiện giao hàng gặp sự cố kỹ thuật", "D": "Giao nhầm địa chỉ"}},
                    "proof": {"explanation": "'delivery van had a flat tire' được paraphrase thành 'delivery vehicle experienced a mechanical problem'.", "evidenceQuote": "Their delivery van had a flat tire on Route 9", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s1-m2"},
                    "wrongOptionsAnalysis": {"A": "Loại — Lỗi đánh máy là trên banner kỹ thuật số.", "B": "Loại — 4:00 P.M. là giờ chốt dàn dựng.", "C": "ĐÚNG — Paraphrase trực tiếp từ 'flat tire'.", "D": "Loại — Không giao nhầm."},
                    "keyTakeaways": {"formula": "Chi tiết cụ thể (flat tire) → Khái quát hóa (mechanical problem)", "commonTrap": "Trộn lỗi typo của banner sang catalog.", "paraphrases": [{"textInPassage": "delivery van had a flat tire", "textInAnswer": "delivery vehicle experienced a mechanical problem", "meaningVi": "xe giao hàng gặp sự cố"}]},
                },
            },
            {
                "id": "p7-s1-q3", "questionNumber": 149, "questionType": "Suy luận (Inference)",
                "prompt": "At 9:21 A.M., what does Mr. Reid most likely mean when he writes, 'Consider it done'?",
                "options": {
                    "A": "He has already finished assembling the display booth.",
                    "B": "He agrees to wait at Metro Hall to receive the delivery.",
                    "C": "He has corrected the pricing error on the digital banner.",
                    "D": "He will attend the budget review in Ms. Ortiz’s place.",
                },
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Hàm ý câu nói (Writer Intention)", "signal": "Đọc yêu cầu của Hannah lúc 9:19 A.M. ngay trước câu trả lời của Marcus."},
                    "translation": {"questionVi": "Lúc 9:21 sáng, ông Reid muốn nói gì khi viết 'Consider it done'?", "optionsVi": {"A": "Đã lắp xong gian hàng", "B": "Đồng ý chờ ở Metro Hall để ký nhận hàng giao", "C": "Đã sửa xong lỗi giá banner", "D": "Sẽ đi họp ngân sách thay cô Ortiz"}},
                    "proof": {"explanation": "Hannah nhờ Marcus ở lại ký nhận catalog ('stay at the venue to sign for the catalogs'), và Marcus nhận lời chắc chắn bằng thành ngữ 'Consider it done'.", "evidenceQuote": "could you stay at the venue to sign for the catalogs?", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s1-m4"},
                    "wrongOptionsAnalysis": {"A": "Loại — Bẫy nghĩa đen chữ 'done'.", "B": "ĐÚNG — Nhận lời chờ ký nhận hàng.", "C": "Loại — Priya sửa banner.", "D": "Loại — Hannah tự đi họp ngân sách."},
                    "keyTakeaways": {"formula": "'Consider it done' = Chắc chắn tôi sẽ làm việc đó ngay.", "commonTrap": "Hiểu theo nghĩa đen là đã làm xong rồi.", "paraphrases": [{"textInPassage": "sign for the catalogs", "textInAnswer": "receive the delivery", "meaningVi": "ký nhận hàng giao"}]},
                },
            },
            {
                "id": "p7-s1-q4", "questionNumber": 150, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "What will Ms. Nair do before 12:00 P.M.?",
                "options": {
                    "A": "Call Apex Printing to confirm the route",
                    "B": "Bring a corrected graphic file to Mr. Reid",
                    "C": "Join a budget review with Ms. Ortiz",
                    "D": "Deliver tabletop monitors to Metro Hall",
                },
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết (Thời gian + Hành động)", "signal": "Tìm mốc 'before noon' (= before 12:00 P.M.) ở tin nhắn cuối lúc 9:23 A.M."},
                    "translation": {"questionVi": "Cô Nair sẽ làm gì trước 12:00 trưa?", "optionsVi": {"A": "Gọi Apex Printing", "B": "Mang tệp đồ họa đã chỉnh sửa tới cho ông Reid", "C": "Dự họp ngân sách", "D": "Giao màn hình để bàn"}},
                    "proof": {"explanation": "Priya nói đang xuất file đã sửa và sẽ mang ổ USB sang cho Marcus trước trưa ('drop the USB drive off with Marcus before noon').", "evidenceQuote": "Already exporting the corrected graphic. I’ll drop the USB drive off with Marcus before noon.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s1-m6"},
                    "wrongOptionsAnalysis": {"A": "Loại — Marcus đã gọi.", "B": "ĐÚNG — before noon = before 12:00 P.M.", "C": "Loại — Chỉ Hannah họp.", "D": "Loại — Marcus lắp màn hình."},
                    "keyTakeaways": {"formula": "before noon = before 12:00 P.M. | drop off = bring", "commonTrap": "Không nhận ra noon = 12:00 P.M.", "paraphrases": [{"textInPassage": "drop the USB drive off ... before noon", "textInAnswer": "bring a corrected graphic file before 12:00 P.M.", "meaningVi": "mang file đã sửa tới trước 12 giờ trưa"}]},
                },
            },
        ],
    },

    # SET 2: SINGLE PASSAGE #2 (MEMO + SCHEDULE TABLE)
    {
        "id": "t1-p7-single-2",
        "title": "Single 2: Thông báo Chuyển đổi Máy chủ Đám mây & Lịch bảo trì",
        "passageCountType": "single",
        "topic": "Công nghệ thông tin & Nội bộ (Memo + Schedule)",
        "passages": [
            {
                "id": "p7-s2-doc1",
                "tabLabel": "Internal Memo & Schedule",
                "genre": "Notice",
                "title": "MEMORANDUM — Cloud Storage Migration Weekend",
                "headerMeta": [
                    {"label": "To", "value": "All Solis Architecture Employees"},
                    {"label": "From", "value": "Tariq Hassan, IT Infrastructure Manager"},
                    {"label": "Date", "value": "April 8"},
                ],
                "tableData": {
                    "headers": ["Phase", "Window (Saturday, April 12)", "Affected System", "User Action Required"],
                    "rows": [
                        {"id": "p7-s2-r1", "cells": ["Phase 1", "12:00 A.M. – 4:00 A.M.", "CAD Blueprint Archive", "Read-only access only"], "viNote": "Giai đoạn 1: Kho bản vẽ CAD chỉ cho phép xem, không chỉnh sửa"},
                        {"id": "p7-s2-r2", "cells": ["Phase 2", "4:00 A.M. – 9:00 A.M.", "Corporate Email & Calendar", "Offline (messages queued)"], "viNote": "Giai đoạn 2: Email & Lịch tạm ngắt (thư đến sẽ xếp hàng chờ)"},
                        {"id": "p7-s2-r3", "cells": ["Phase 3", "9:00 A.M. – 12:00 P.M.", "Payroll & HR Portal", "Offline for database sync"], "viNote": "Giai đoạn 3: Cổng Nhân sự & Lương tạm ngắt đồng bộ"},
                    ],
                },
                "paragraphs": [
                    {
                        "id": "p7-s2-p1",
                        "sentences": [
                            {"id": "p7-s2-s1", "en": "This Saturday, April 12, our IT team will migrate Solis Architecture’s legacy on-premise servers to an encrypted cloud platform. — [1] —.",
                             "vi": "Thứ Bảy ngày 12/4 này, đội CNTT sẽ chuyển các máy chủ tại chỗ cũ của Solis Architecture lên nền tảng đám mây mã hóa. — [1] —."},
                            {"id": "p7-s2-s2", "en": "The upgrade will triple file-transfer speeds for field engineers accessing large 3D blueprints from construction sites. — [2] —.",
                             "vi": "Đợt nâng cấp sẽ tăng gấp ba tốc độ truyền tệp cho kỹ sư công trường truy cập các bản vẽ 3D dung lượng lớn. — [2] —."},
                        ],
                    },
                    {
                        "id": "p7-s2-p2",
                        "sentences": [
                            {"id": "p7-s2-s3", "en": "Before leaving the office on Friday, April 11, please save and close all open CAD files and log out of the shared drive. — [3] —.",
                             "vi": "Trước khi rời văn phòng vào thứ Sáu ngày 11/4, vui lòng lưu, đóng tất cả tệp CAD đang mở và đăng xuất khỏi ổ đĩa dùng chung. — [3] —."},
                            {"id": "p7-s2-s4", "en": "Any incoming emails sent during Phase 2 will NOT be lost; they will automatically appear in your inbox once service resumes at 9:00 A.M. — [4] —. On Monday morning, all staff will be prompted to create a new twelve-character password upon their first login.",
                             "vi": "Mọi email gửi tới trong Giai đoạn 2 sẽ KHÔNG bị mất; chúng sẽ tự động hiện trong hộp thư khi dịch vụ hoạt động lại lúc 9:00 sáng. — [4] —. Sáng thứ Hai, toàn thể nhân viên sẽ được nhắc tạo mật khẩu 12 ký tự mới trong lần đăng nhập đầu tiên."},
                        ],
                    },
                ],
            }
        ],
        "questions": [
            {
                "id": "p7-s2-q1", "questionNumber": 153, "questionType": "Ý chính (Main Idea)",
                "prompt": "What is one stated benefit of the upcoming server migration?",
                "options": {
                    "A": "Lower monthly internet subscription costs",
                    "B": "Faster remote access to heavy blueprint files",
                    "C": "Elimination of password login requirements",
                    "D": "Automatic approval of employee payroll forms",
                },
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết lợi ích", "signal": "Đọc câu thứ 2 đoạn 1 về lợi ích của đợt nâng cấp."},
                    "translation": {"questionVi": "Một lợi ích được nêu của đợt chuyển đổi máy chủ sắp tới là gì?", "optionsVi": {"A": "Giảm phí mạng hàng tháng", "B": "Truy cập từ xa nhanh hơn vào các tệp bản vẽ dung lượng lớn", "C": "Loại bỏ yêu cầu mật khẩu", "D": "Tự động duyệt bảng lương"}},
                    "proof": {"explanation": "Bài ghi rõ: 'triple file-transfer speeds for field engineers accessing large 3D blueprints from construction sites'.", "evidenceQuote": "The upgrade will triple file-transfer speeds for field engineers accessing large 3D blueprints from construction sites.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s2-s2"},
                    "wrongOptionsAnalysis": {"A": "Loại — Không nhắc chi phí mạng.", "B": "ĐÚNG — triple speeds + from construction sites = faster remote access.", "C": "Loại — Ngược sự thật (thứ Hai phải tạo mật khẩu 12 ký tự mới).", "D": "Loại — Payroll chỉ tạm ngắt để đồng bộ."},
                    "keyTakeaways": {"formula": "from construction sites ↔ remote access | large 3D blueprints ↔ heavy blueprint files", "commonTrap": "Bẫy đảo ngược ở C (tạo mật khẩu mới ≠ bỏ mật khẩu).", "paraphrases": [{"textInPassage": "triple file-transfer speeds", "textInAnswer": "faster access", "meaningVi": "tốc độ truy cập nhanh hơn"}]},
                },
            },
            {
                "id": "p7-s2-q2", "questionNumber": 154, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "According to the schedule, which system will be unavailable at 10:30 A.M. on Saturday?",
                "options": {
                    "A": "CAD Blueprint Archive",
                    "B": "Corporate Email",
                    "C": "Payroll & HR Portal",
                    "D": "Company Telephone Line",
                },
                "correctAnswer": "C",
                "explanation": {
                    "classification": {"category": "Part 7 — Đọc bảng thời gian (Schedule Lookup)", "signal": "Tra mốc 10:30 A.M. nằm trong khung 9:00 A.M. – 12:00 P.M. (Phase 3)."},
                    "translation": {"questionVi": "Theo lịch trình, hệ thống nào sẽ không khả dụng vào lúc 10:30 sáng thứ Bảy?", "optionsVi": {"A": "Kho bản vẽ CAD", "B": "Email công ty", "C": "Cổng Nhân sự & Lương", "D": "Đường dây điện thoại"}},
                    "proof": {"explanation": "Trong bảng, khung giờ 9:00 A.M. – 12:00 P.M. là Phase 3: 'Payroll & HR Portal — Offline for database sync'.", "evidenceQuote": "once service resumes at 9:00 A.M.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s2-s4"},
                    "wrongOptionsAnalysis": {"A": "Loại — Phase 1 kết thúc lúc 4:00 A.M.", "B": "Loại — Email mở lại lúc 9:00 A.M.", "C": "ĐÚNG — 10:30 A.M. nằm giữa 9:00 A.M. – 12:00 P.M.", "D": "Loại — Không có trong bảng."},
                    "keyTakeaways": {"formula": "Đối chiếu khung giờ bắt đầu – kết thúc trên bảng biểu.", "commonTrap": "Nhầm 12:00 A.M. (nửa đêm) với 12:00 P.M. (buổi trưa).", "paraphrases": [{"textInPassage": "Offline for database sync", "textInAnswer": "unavailable", "meaningVi": "tạm ngắt không khả dụng"}]},
                },
            },
            {
                "id": "p7-s2-q3", "questionNumber": 155, "questionType": "Điền câu [1][2][3][4]",
                "prompt": "In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong? 'Unsaved edits left open overnight risk becoming corrupted during the transfer.'",
                "options": {"A": "[1]", "B": "[2]", "C": "[3]", "D": "[4]"},
                "correctAnswer": "C",
                "explanation": {
                    "classification": {"category": "Part 7 — Chèn câu [1][2][3][4]", "signal": "Từ khóa 'Unsaved edits left open' nối trực tiếp với lời nhắc 'save and close all open CAD files' ngay trước [3]!"},
                    "translation": {"questionVi": "Câu 'Các chỉnh sửa chưa lưu để mở qua đêm có nguy cơ bị hỏng trong quá trình chuyển đổi' hợp nhất ở vị trí nào?", "optionsVi": {"A": "[1]", "B": "[2]", "C": "[3]", "D": "[4]"}},
                    "proof": {"explanation": "Câu trước [3] yêu cầu 'save and close all open CAD files'. Đặt câu cảnh báo 'Unsaved edits left open...' ngay tại [3] giải thích trực tiếp lý do phải lưu và đóng file.", "evidenceQuote": "please save and close all open CAD files and log out of the shared drive. — [3] —.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s2-s3"},
                    "wrongOptionsAnalysis": {"A": "Loại — Chưa nhắc tới việc lưu tệp.", "B": "Loại — Đoạn 1 đang nói lợi ích tốc độ.", "C": "ĐÚNG — Khớp từ khóa 'save and close all open CAD files' ↔ 'Unsaved edits left open'.", "D": "Loại — Câu trước [4] nói về Email."},
                    "keyTakeaways": {"formula": "Hướng dẫn (save & close open files) → Lý do/Cảnh báo (Unsaved edits left open...)", "commonTrap": "Chèn nhầm vào đoạn 1 vì thấy từ 'transfer'.", "paraphrases": [{"textInPassage": "risk becoming corrupted", "textInAnswer": "may be damaged", "meaningVi": "có nguy cơ bị lỗi hỏng file"}]},
                },
            },
            {
                "id": "p7-s2-q4", "questionNumber": 156, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "What must employees do on Monday morning?",
                "options": {
                    "A": "Resend emails that bounced on Saturday",
                    "B": "Set up a new login password",
                    "C": "Back up files to external USB drives",
                    "D": "Attend a mandatory cloud-security seminar",
                },
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết mốc thời gian (Monday morning)", "signal": "Tìm cụm 'On Monday morning' ở câu cuối đoạn văn."},
                    "translation": {"questionVi": "Nhân viên phải làm gì vào sáng thứ Hai?", "optionsVi": {"A": "Gửi lại email bị lỗi thứ Bảy", "B": "Tạo mật khẩu đăng nhập mới", "C": "Sao lưu ra USB", "D": "Dự hội thảo bảo mật"}},
                    "proof": {"explanation": "Câu cuối ghi rõ: 'On Monday morning, all staff will be prompted to create a new twelve-character password upon their first login.'", "evidenceQuote": "On Monday morning, all staff will be prompted to create a new twelve-character password upon their first login.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-s2-s4"},
                    "wrongOptionsAnalysis": {"A": "Loại — Email thứ Bảy tự động vào hộp thư, không bị mất.", "B": "ĐÚNG — create a new password = set up a new login password.", "C": "Loại — Không nhắc USB.", "D": "Loại — Không có hội thảo."},
                    "keyTakeaways": {"formula": "be prompted to create a new password = set up a new login password", "commonTrap": "Đọc lướt câu cuối đoạn văn.", "paraphrases": [{"textInPassage": "create a new twelve-character password", "textInAnswer": "set up a new login password", "meaningVi": "thiết lập mật khẩu đăng nhập mới"}]},
                },
            },
        ],
    },

    # SET 3: DOUBLE PASSAGE #1 (JOB POSTING + APPLICANT EMAIL)
    {
        "id": "t1-p7-double-1",
        "title": "Double 1: Tin tuyển dụng & Email ứng tuyển Chuyên viên Dữ liệu",
        "passageCountType": "double",
        "topic": "Nhân sự & Tuyển dụng (Job Posting + Email)",
        "passages": [
            {
                "id": "p7-d1-doc1", "tabLabel": "Passage 1: Job Posting", "genre": "Job Posting",
                "title": "Northstar Logistics — Career Opportunity",
                "headerMeta": [
                    {"label": "Position", "value": "Senior Supply Chain Data Analyst (Full-Time)"},
                    {"label": "Location", "value": "Seattle Headquarters (Hybrid: 3 days in-office)"},
                    {"label": "Application Deadline", "value": "November 15"},
                ],
                "paragraphs": [
                    {"id": "p7-d1-p1", "sentences": [
                        {"id": "p7-d1-s1", "en": "Northstar Logistics, a leading Pacific Northwest freight management firm, is seeking a Senior Supply Chain Data Analyst to optimize our regional distribution network.",
                         "vi": "Northstar Logistics, công ty quản lý vận tải hàng đầu khu vực Tây Bắc Thái Bình Dương, đang tuyển Chuyên viên Phân tích Dữ liệu Chuỗi cung ứng Cấp cao để tối ưu mạng lưới phân phối."},
                        {"id": "p7-d1-s2", "en": "The successful candidate will develop forecasting dashboards, evaluate warehouse efficiency, and present quarterly recommendations to executive leadership. — [1] —.",
                         "vi": "Ứng viên trúng tuyển sẽ xây bảng điều khiển dự báo, đánh giá hiệu suất kho và trình bày khuyến nghị hàng quý trước ban lãnh đạo cấp cao. — [1] —."},
                    ]},
                    {"id": "p7-d1-p2", "sentences": [
                        {"id": "p7-d1-s3", "en": "Required Qualifications: A bachelor’s degree in statistics, economics, or a related field; at least five years of experience in logistics analytics; and advanced proficiency in SQL and Tableau. — [2] —.",
                         "vi": "Yêu cầu bắt buộc: Cử nhân thống kê, kinh tế hoặc ngành liên quan; ít nhất 5 năm kinh nghiệm phân tích logistics; thành thạo nâng cao SQL và Tableau. — [2] —."},
                        {"id": "p7-d1-s4", "en": "Fluency in Spanish is not mandatory but will be considered a strong asset due to our growing partnerships in Mexico. — [3] —.",
                         "vi": "Thông thạo tiếng Tây Ban Nha không bắt buộc nhưng là lợi thế lớn nhờ quan hệ đối tác mở rộng tại Mexico. — [3] —."},
                    ]},
                    {"id": "p7-d1-p3", "sentences": [
                        {"id": "p7-d1-s5", "en": "To apply, please email your résumé, a cover letter, and two professional references to careers@northstarlogistics.com with the subject line 'Analyst Application – [Your Name]'. — [4] —. Note that only shortlisted candidates will be contacted for interviews.",
                         "vi": "Để ứng tuyển, gửi email kèm CV, thư xin việc và hai người tham chiếu tới careers@northstarlogistics.com với tiêu đề 'Analyst Application – [Tên]'. — [4] —. Chỉ ứng viên vào danh sách rút gọn mới được liên hệ phỏng vấn."},
                    ]},
                ],
            },
            {
                "id": "p7-d1-doc2", "tabLabel": "Passage 2: Applicant Email", "genre": "Email",
                "title": "Email ứng tuyển của Elena Vargas",
                "headerMeta": [
                    {"label": "From", "value": "Elena Vargas <e.vargas@mailbridge.net>"},
                    {"label": "To", "value": "careers@northstarlogistics.com"},
                    {"label": "Date", "value": "November 11"},
                    {"label": "Subject", "value": "Analyst Application – Elena Vargas"},
                ],
                "paragraphs": [
                    {"id": "p7-d1-p4", "sentences": [
                        {"id": "p7-d1-s6", "en": "Dear Hiring Manager, I am writing to express my keen interest in the Senior Supply Chain Data Analyst role advertised on your corporate website.",
                         "vi": "Kính gửi Quản lý Tuyển dụng, tôi viết thư bày tỏ sự quan tâm sâu sắc đến vị trí Chuyên viên Phân tích Dữ liệu Chuỗi cung ứng Cấp cao trên website quý công ty."},
                        {"id": "p7-d1-s7", "en": "For the past six years, I have worked at Cascade Maritime Group, where I built automated Tableau dashboards that cut warehouse turnaround times by 19 percent.",
                         "vi": "Trong sáu năm qua, tôi làm việc tại Cascade Maritime Group, xây dựng bảng Tableau tự động giúp giảm 19% thời gian quay vòng kho bãi."},
                    ]},
                    {"id": "p7-d1-p5", "sentences": [
                        {"id": "p7-d1-s8", "en": "In addition to my degree in Applied Economics and daily work with SQL databases, I grew up bilingual in English and Spanish and frequently liaise with freight coordinators in Guadalajara.",
                         "vi": "Ngoài bằng Kinh tế Ứng dụng và làm việc hàng ngày với SQL, tôi lớn lên song ngữ Anh – Tây Ban Nha và thường xuyên liên hệ điều phối viên vận tải ở Guadalajara."},
                        {"id": "p7-d1-s9", "en": "I have attached my résumé and cover letter to this message. Because my former director is currently traveling overseas, I will forward the contact details for my references by Thursday, November 14, ahead of your closing date.",
                         "vi": "Tôi đã đính kèm CV và thư xin việc. Vì cựu giám đốc của tôi đang công tác nước ngoài, tôi sẽ gửi bổ sung thông tin người tham chiếu trước thứ Năm ngày 14/11, trước hạn chót của quý công ty."},
                    ]},
                ],
            },
        ],
        "questions": [
            {
                "id": "p7-d1-q1", "questionNumber": 176, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "What is stated about the advertised position at Northstar Logistics?",
                "options": {"A": "It requires employees to work remotely full-time.", "B": "It involves reporting recommendations to senior leaders.", "C": "It is a temporary six-month contract role.", "D": "It requires relocating to Mexico."},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết (Passage 1)", "signal": "Đoạn 1 mô tả nhiệm vụ công việc."},
                    "translation": {"questionVi": "Điều gì được nêu về vị trí tuyển dụng tại Northstar Logistics?", "optionsVi": {"A": "Làm từ xa toàn thời gian", "B": "Báo cáo các khuyến nghị lên lãnh đạo cấp cao", "C": "Hợp đồng tạm thời 6 tháng", "D": "Phải chuyển sang Mexico"}},
                    "proof": {"explanation": "'present quarterly recommendations to executive leadership' = reporting recommendations to senior leaders.", "evidenceQuote": "present quarterly recommendations to executive leadership.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-d1-s2"},
                    "wrongOptionsAnalysis": {"A": "Loại — Hybrid 3 ngày văn phòng.", "B": "ĐÚNG — Paraphrase trực tiếp.", "C": "Loại — Full-Time.", "D": "Loại — Chỉ hợp tác đối tác ở Mexico."},
                    "keyTakeaways": {"formula": "executive leadership ↔ senior leaders", "commonTrap": "Bẫy địa danh 'Mexico' ở D.", "paraphrases": [{"textInPassage": "present recommendations to executive leadership", "textInAnswer": "reporting recommendations to senior leaders", "meaningVi": "báo cáo khuyến nghị lên lãnh đạo cấp cao"}]},
                },
            },
            {
                "id": "p7-d1-q2", "questionNumber": 177, "questionType": "Điền câu [1][2][3][4]",
                "prompt": "In which position marked [1], [2], [3], or [4] in Passage 1 does the sentence best belong? 'Candidates who already hold a Tableau Desktop certification will also stand out.'",
                "options": {"A": "[1]", "B": "[2]", "C": "[3]", "D": "[4]"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chèn câu [1][2][3][4]", "signal": "Từ khóa 'Tableau Desktop certification' bám ngay sau 'SQL and Tableau' trước [2]."},
                    "translation": {"questionVi": "Câu về chứng chỉ Tableau Desktop hợp nhất ở vị trí nào?", "optionsVi": {"A": "[1]", "B": "[2]", "C": "[3]", "D": "[4]"}},
                    "proof": {"explanation": "Câu trước [2] kết thúc bằng 'advanced proficiency in SQL and Tableau', nối mạch kỹ thuật trực tiếp sang chứng chỉ Tableau.", "evidenceQuote": "and advanced proficiency in SQL and Tableau. — [2] —.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-d1-s3"},
                    "wrongOptionsAnalysis": {"A": "Loại — Chưa nhắc Tableau.", "B": "ĐÚNG — Nối trực tiếp từ khóa Tableau.", "C": "Loại — Sau câu tiếng Tây Ban Nha.", "D": "Loại — Đoạn cách nộp hồ sơ."},
                    "keyTakeaways": {"formula": "Bám sát danh từ lặp ('Tableau') để chọn chính xác vị trí.", "commonTrap": "Chọn nhầm [3] vì cùng nói về điểm cộng.", "paraphrases": [{"textInPassage": "stand out", "textInAnswer": "have a competitive advantage", "meaningVi": "nổi bật hơn ứng viên khác"}]},
                },
            },
            {
                "id": "p7-d1-q3", "questionNumber": 178, "questionType": "Suy luận (Inference)",
                "prompt": "What is suggested about Ms. Vargas based on both passages?",
                "options": {"A": "She meets all mandatory qualifications as well as the preferred language skill.", "B": "She has less logistics experience than the job posting requires.", "C": "She previously worked with Northstar’s leadership team.", "D": "She missed the application deadline by one day."},
                "correctAnswer": "A",
                "explanation": {
                    "classification": {"category": "Part 7 — Suy luận kết hợp P1 & P2", "signal": "Đối chiếu bảng tiêu chuẩn P1 với kinh nghiệm Elena ở P2."},
                    "translation": {"questionVi": "Điều gì được suy ra về cô Vargas dựa trên cả hai đoạn?", "optionsVi": {"A": "Đáp ứng đủ mọi yêu cầu bắt buộc và cả kỹ năng ngôn ngữ ưu tiên", "B": "Ít kinh nghiệm hơn yêu cầu", "C": "Từng làm với lãnh đạo Northstar", "D": "Nộp trễ hạn 1 ngày"}},
                    "proof": {"explanation": "Elena có bằng Kinh tế, 6 năm kinh nghiệm (>5), SQL & Tableau và song ngữ Anh – Tây Ban Nha.", "evidenceQuote": "In addition to my degree in Applied Economics and daily work with SQL databases, I grew up bilingual in English and Spanish", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d1-s8"},
                    "wrongOptionsAnalysis": {"A": "ĐÚNG — Đủ 100% bắt buộc + ưu tiên Spanish.", "B": "Loại — 6 năm > 5 năm.", "C": "Loại — Làm ở Cascade Maritime Group.", "D": "Loại — Nov 11 & Nov 14 đều trước Nov 15."},
                    "keyTakeaways": {"formula": "Lập checklist đối chiếu yêu cầu (P1) ↔ hồ sơ thực tế (P2).", "commonTrap": "Nhầm số 6 năm với 5 năm.", "paraphrases": [{"textInPassage": "strong asset", "textInAnswer": "preferred language skill", "meaningVi": "kỹ năng ngôn ngữ ưu tiên"}]},
                },
            },
            {
                "id": "p7-d1-q4", "questionNumber": 179, "questionType": "Loại trừ (NOT/TRUE)",
                "prompt": "Which required application item did Ms. Vargas NOT include with her November 11 email?",
                "options": {"A": "Her résumé", "B": "A cover letter", "C": "The correct email subject line", "D": "Professional reference contacts"},
                "correctAnswer": "D",
                "explanation": {
                    "classification": {"category": "Part 7 — Loại trừ kết hợp 2 đoạn (NOT)", "signal": "Kiểm tra đoạn cuối P2 xem mục nào gửi sau."},
                    "translation": {"questionVi": "Mục bắt buộc nào cô Vargas KHÔNG đính kèm trong email ngày 11/11?", "optionsVi": {"A": "CV", "B": "Thư xin việc", "C": "Tiêu đề email đúng chuẩn", "D": "Thông tin liên hệ người tham chiếu"}},
                    "proof": {"explanation": "Elena hẹn gửi bổ sung thông tin người tham chiếu vào thứ Năm ngày 14/11.", "evidenceQuote": "I will forward the contact details for my references by Thursday, November 14", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d1-s9"},
                    "wrongOptionsAnalysis": {"A": "Loại — Đã đính kèm.", "B": "Loại — Đã đính kèm.", "C": "Loại — Tiêu đề khớp chuẩn P1.", "D": "ĐÚNG — Gửi sau ngày 14/11."},
                    "keyTakeaways": {"formula": "Gạch bỏ 3 mục đã xuất hiện ở Header/Body P2 → chọn mục còn lại.", "commonTrap": "Quên kiểm tra dòng Subject ở Header email.", "paraphrases": [{"textInPassage": "contact details for my references", "textInAnswer": "professional reference contacts", "meaningVi": "thông tin người tham chiếu"}]},
                },
            },
            {
                "id": "p7-d1-q5", "questionNumber": 180, "questionType": "Từ đồng nghĩa (Vocab in Context)",
                "prompt": "In Passage 2, paragraph 2, the word 'liaise' is closest in meaning to",
                "options": {"A": "compete", "B": "communicate", "C": "relocate", "D": "disagree"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Từ vựng ngữ cảnh", "signal": "'liaise with freight coordinators' (liên lạc, phối hợp công việc)."},
                    "translation": {"questionVi": "Từ 'liaise' gần nghĩa nhất với từ nào?", "optionsVi": {"A": "cạnh tranh", "B": "giao tiếp, liên hệ trao đổi", "C": "chuyển địa điểm", "D": "bất đồng"}},
                    "proof": {"explanation": "'liaise with' nghĩa là giữ liên lạc và phối hợp giữa các bên = communicate with.", "evidenceQuote": "frequently liaise with freight coordinators in Guadalajara.", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d1-s8"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "ĐÚNG — liaise with = communicate with.", "C": "Loại.", "D": "Loại."},
                    "keyTakeaways": {"formula": "liaise with sb = communicate / coordinate with sb", "commonTrap": "Đoán mò khi gặp từ C1 thay vì đọc ngữ cảnh 'bilingual ... with coordinators'.", "paraphrases": [{"textInPassage": "liaise with", "textInAnswer": "communicate with", "meaningVi": "liên hệ phối hợp"}]},
                },
            },
        ],
    },

    # SET 4: DOUBLE PASSAGE #2 (CONFERENCE SCHEDULE + ATTENDEE EMAIL)
    {
        "id": "t1-p7-double-2",
        "title": "Double 2: Lịch trình Diễn đàn FinTech & Email góp ý của Đại biểu",
        "passageCountType": "double",
        "topic": "Hội nghị & Sự kiện (Schedule + Email)",
        "passages": [
            {
                "id": "p7-d2-doc1", "tabLabel": "Passage 1: Forum Schedule", "genre": "Schedule",
                "title": "Asia-Pacific FinTech Forum — Day 1 Morning Schedule (June 6)",
                "headerMeta": [
                    {"label": "Venue", "value": "Marina Convention Center, Singapore"},
                    {"label": "Registration Desk", "value": "Opens at 8:00 A.M. (Main Foyer)"},
                ],
                "tableData": {
                    "headers": ["Time", "Session Title", "Speaker", "Room"],
                    "rows": [
                        {"id": "p7-d2-r1", "cells": ["9:00 – 9:45 A.M.", "Keynote: Cross-Border Instant Payments", "Dr. Kenji Mori", "Grand Hall"], "viNote": "9:00–9:45: Bài diễn văn chính về thanh toán xuyên biên giới — TS. Kenji Mori — Grand Hall"},
                        {"id": "p7-d2-r2", "cells": ["10:00 – 10:45 A.M.", "AI Fraud Detection in Retail Banking", "Sofia Lindholm", "Room 204"], "viNote": "10:00–10:45: Phát hiện gian lận bằng AI — Sofia Lindholm — Room 204"},
                        {"id": "p7-d2-r3", "cells": ["11:00 – 11:45 A.M.", "Green Bonds & Sustainable Lending", "Rohan Kapoor", "Room 208"], "viNote": "11:00–11:45: Trái phiếu xanh & tín dụng bền vững — Rohan Kapoor — Room 208"},
                        {"id": "p7-d2-r4", "cells": ["12:00 – 1:15 P.M.", "Networking Buffet Lunch", "All Delegates", "Harbor Terrace"], "viNote": "12:00–13:15: Tiệc trưa buffet giao lưu — Sân thượng Harbor"},
                    ],
                },
                "paragraphs": [
                    {"id": "p7-d2-p1", "sentences": [
                        {"id": "p7-d2-s1", "en": "Note: All breakout rooms are limited to 80 seats on a first-come, first-served basis. Slides and audio recordings will be emailed to registered delegates within 48 hours after the forum concludes.",
                         "vi": "Lưu ý: Mọi phòng thảo luận nhóm giới hạn 80 chỗ theo nguyên tắc ai đến trước ngồi trước. Slide và bản ghi âm sẽ được gửi email cho đại biểu đã đăng ký trong vòng 48 giờ sau khi diễn đàn kết thúc."},
                    ]},
                ],
            },
            {
                "id": "p7-d2-doc2", "tabLabel": "Passage 2: Attendee Email", "genre": "Email",
                "title": "Email phản hồi từ Đại biểu Clara Jensen",
                "headerMeta": [
                    {"label": "From", "value": "Clara Jensen <cjensen@nordicpay.eu>"},
                    {"label": "To", "value": "events@apfintechforum.org"},
                    {"label": "Date", "value": "June 7"},
                    {"label": "Subject", "value": "Feedback on Day 1 & Slide Access Request"},
                ],
                "paragraphs": [
                    {"id": "p7-d2-p2", "sentences": [
                        {"id": "p7-d2-s2", "en": "Dear Forum Organizers, Thank you for hosting such a well-organized opening day yesterday. Dr. Mori’s opening talk offered tremendous insights for our regional payments team.",
                         "vi": "Kính gửi Ban tổ chức Diễn đàn, cảm ơn quý vị đã tổ chức ngày khai mạc thật bài bản hôm qua. Bài nói mở màn của Tiến sĩ Mori mang lại nhiều góc nhìn giá trị cho nhóm thanh toán khu vực của chúng tôi."},
                        {"id": "p7-d2-s3", "en": "Unfortunately, when I arrived at Room 204 at 9:55 A.M., every seat was already taken, and staff asked latecomers to stand in the hallway. Because that topic was my primary reason for flying from Copenhagen, I was quite disappointed to miss it.",
                         "vi": "Thật tiếc, khi tôi tới Phòng 204 lúc 9:55 sáng, toàn bộ ghế đã kín chỗ và nhân viên yêu cầu người đến sau đứng ngoài hành lang. Vì chủ đề đó là lý do chính khiến tôi bay từ Copenhagen sang, tôi khá thất vọng khi bỏ lỡ nó."},
                    ]},
                    {"id": "p7-d2-p3", "sentences": [
                        {"id": "p7-d2-s4", "en": "For next year’s forum, I suggest relocating high-interest AI sessions to the Grand Hall or enabling advance seat reservations inside the event app. Meanwhile, could you confirm whether the recording of the 10:00 A.M. talk will include the live Q&A segment?",
                         "vi": "Cho diễn đàn năm sau, tôi đề xuất chuyển các phiên AI được quan tâm cao sang Grand Hall hoặc bật tính năng đặt ghế trước trong ứng dụng sự kiện. Trong lúc chờ đợi, quý vị có thể xác nhận bản ghi âm bài nói lúc 10:00 sáng có bao gồm phần hỏi đáp trực tiếp không?"},
                    ]},
                ],
            },
        ],
        "questions": [
            {
                "id": "p7-d2-q1", "questionNumber": 186, "questionType": "Suy luận (Inference)",
                "prompt": "Whose session was Ms. Jensen unable to attend on June 6?",
                "options": {"A": "Dr. Kenji Mori’s", "B": "Sofia Lindholm’s", "C": "Rohan Kapoor’s", "D": "The Networking Buffet Lunch"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Tra chéo Phòng/Giờ (P2 → P1)", "signal": "P2: 'Room 204 at 9:55 A.M.' và '10:00 A.M. talk' → Tra bảng P1 xem ai nói lúc 10:00 A.M. tại Room 204!"},
                    "translation": {"questionVi": "Cô Jensen đã không thể tham dự phiên nói chuyện của ai vào ngày 6/6?", "optionsVi": {"A": "TS. Kenji Mori", "B": "Sofia Lindholm", "C": "Rohan Kapoor", "D": "Bữa trưa giao lưu"}},
                    "proof": {"explanation": "P2 nêu cô đến Room 204 lúc 9:55 và hỏi bản ghi âm bài nói 10:00 A.M. về AI. Bảng P1 cho biết phiên 10:00 – 10:45 tại Room 204 (AI Fraud Detection) do Sofia Lindholm trình bày.", "evidenceQuote": "when I arrived at Room 204 at 9:55 A.M., every seat was already taken", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d2-s3"},
                    "wrongOptionsAnalysis": {"A": "Loại — Cô đã dự và khen bài của TS. Mori.", "B": "ĐÚNG — Sofia Lindholm thuyết trình tại Room 204 lúc 10:00 A.M.", "C": "Loại — Rohan Kapoor ở Room 208 lúc 11:00.", "D": "Loại — Không phải phiên nói chuyện."},
                    "keyTakeaways": {"formula": "Room 204 + 10:00 A.M. (Email) → Tra cột Speaker trên Schedule.", "commonTrap": "Chọn nhầm Dr. Mori vì tên ông xuất hiện ngay câu đầu email.", "paraphrases": [{"textInPassage": "every seat was already taken", "textInAnswer": "room reached full capacity", "meaningVi": "phòng đã kín hết chỗ ngồi"}]},
                },
            },
            {
                "id": "p7-d2-q2", "questionNumber": 187, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "Why could Ms. Jensen not enter Room 204?",
                "options": {"A": "Her registration badge had not been activated.", "B": "The speaker canceled the presentation unexpectedly.", "C": "The 80-seat room was already completely full.", "D": "The session was moved to Harbor Terrace."},
                "correctAnswer": "C",
                "explanation": {
                    "classification": {"category": "Part 7 — Kết hợp chi tiết P1 & P2", "signal": "P1 quy định phòng giới hạn 80 chỗ (first-come, first-served) + P2: 'every seat was already taken'."},
                    "translation": {"questionVi": "Tại sao cô Jensen không thể vào Phòng 204?", "optionsVi": {"A": "Thẻ đăng ký chưa kích hoạt", "B": "Diễn giả hủy bài nói", "C": "Căn phòng 80 chỗ đã hoàn toàn kín chỗ", "D": "Phiên bị chuyển ra Harbor Terrace"}},
                    "proof": {"explanation": "P1 ghi phòng thảo luận giới hạn 80 chỗ và P2 ghi mọi ghế đã kín lúc 9:55 sáng.", "evidenceQuote": "All breakout rooms are limited to 80 seats on a first-come, first-served basis.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-d2-s1"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "Loại.", "C": "ĐÚNG — Kết hợp con số 80 seats (P1) và full (P2).", "D": "Loại."},
                    "keyTakeaways": {"formula": "first-come, first-served + every seat taken = completely full", "commonTrap": "Không đối chiếu dòng Note cuối P1 để xác nhận sức chứa 80 chỗ.", "paraphrases": [{"textInPassage": "every seat was already taken", "textInAnswer": "completely full", "meaningVi": "đã kín chỗ hoàn toàn"}]},
                },
            },
            {
                "id": "p7-d2-q3", "questionNumber": 188, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "What does Ms. Jensen recommend for next year’s event?",
                "options": {"A": "Offering breakfast before 8:00 A.M.", "B": "Using a larger hall or app-based seat booking for popular talks", "C": "Shortening the networking buffet lunch", "D": "Holding the forum in Copenhagen"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết đề xuất (Passage 2)", "signal": "Tìm cụm 'For next year’s forum, I suggest...'."},
                    "translation": {"questionVi": "Cô Jensen đề xuất gì cho sự kiện năm tới?", "optionsVi": {"A": "Phục vụ bữa sáng trước 8 giờ", "B": "Dùng hội trường lớn hơn hoặc đặt ghế qua app cho các phiên thu hút", "C": "Rút ngắn tiệc trưa", "D": "Tổ chức diễn đàn ở Copenhagen"}},
                    "proof": {"explanation": "Cô đề xuất chuyển các phiên AI sang Grand Hall hoặc bật tính năng đặt chỗ trước trên app.", "evidenceQuote": "relocating high-interest AI sessions to the Grand Hall or enabling advance seat reservations inside the event app.", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d2-s4"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "ĐÚNG — Grand Hall = larger hall; advance seat reservations in app = app-based seat booking.", "C": "Loại.", "D": "Loại — Copenhagen chỉ là nơi cô bay tới Singapore."},
                    "keyTakeaways": {"formula": "high-interest sessions ↔ popular talks", "commonTrap": "Bẫy địa danh Copenhagen ở D.", "paraphrases": [{"textInPassage": "advance seat reservations inside the event app", "textInAnswer": "app-based seat booking", "meaningVi": "đặt chỗ trước qua ứng dụng"}]},
                },
            },
            {
                "id": "p7-d2-q4", "questionNumber": 189, "questionType": "Suy luận (Inference)",
                "prompt": "When will Ms. Jensen most likely receive the slides and audio recordings?",
                "options": {"A": "Before June 6", "B": "During the networking lunch", "C": "Within two days after the forum ends", "D": "Only if she pays an extra media fee"},
                "correctAnswer": "C",
                "explanation": {
                    "classification": {"category": "Part 7 — Quy đổi thời gian (48 hours = two days)", "signal": "Đọc dòng Note cuối Passage 1: 'within 48 hours after the forum concludes'."},
                    "translation": {"questionVi": "Khi nào cô Jensen nhiều khả năng nhận được slide và bản ghi âm?", "optionsVi": {"A": "Trước ngày 6/6", "B": "Trong bữa trưa giao lưu", "C": "Trong vòng hai ngày sau khi diễn đàn kết thúc", "D": "Chỉ khi trả thêm phí"}},
                    "proof": {"explanation": "Note của P1 ghi rõ gửi trong vòng 48 giờ (= two days) sau khi diễn đàn kết thúc.", "evidenceQuote": "Slides and audio recordings will be emailed to registered delegates within 48 hours after the forum concludes.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-d2-s1"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "Loại.", "C": "ĐÚNG — 48 hours = two days; concludes = ends.", "D": "Loại — Miễn phí cho đại biểu đã đăng ký."},
                    "keyTakeaways": {"formula": "48 hours = two days | concludes = ends", "commonTrap": "Quên quy đổi giờ sang ngày.", "paraphrases": [{"textInPassage": "within 48 hours after the forum concludes", "textInAnswer": "within two days after the forum ends", "meaningVi": "trong vòng 2 ngày sau khi kết thúc"}]},
                },
            },
            {
                "id": "p7-d2-q5", "questionNumber": 190, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "What specific question does Ms. Jensen ask the organizers at the end of her email?",
                "options": {"A": "Whether Dr. Mori’s slides are available in Danish", "B": "Whether the 10:00 A.M. recording captures the Q&A portion", "C": "How to apply to become a speaker next year", "D": "Where to pick up lost items in the Main Foyer"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Câu hỏi cuối email (Passage 2)", "signal": "Đọc câu hỏi cuối cùng của email Clara Jensen."},
                    "translation": {"questionVi": "Cô Jensen hỏi ban tổ chức câu hỏi cụ thể nào ở cuối email?", "optionsVi": {"A": "Slide của TS. Mori có tiếng Đan Mạch không", "B": "Bản ghi âm lúc 10:00 sáng có bao gồm phần hỏi đáp không", "C": "Cách đăng ký làm diễn giả năm tới", "D": "Nơi nhận đồ thất lạc"}},
                    "proof": {"explanation": "Câu cuối email: 'could you confirm whether the recording of the 10:00 A.M. talk will include the live Q&A segment?'", "evidenceQuote": "could you confirm whether the recording of the 10:00 A.M. talk will include the live Q&A segment?", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-d2-s4"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "ĐÚNG — include the live Q&A segment = captures the Q&A portion.", "C": "Loại.", "D": "Loại."},
                    "keyTakeaways": {"formula": "segment = portion / part", "commonTrap": "Đọc lướt câu cuối cùng trong email.", "paraphrases": [{"textInPassage": "include the live Q&A segment", "textInAnswer": "captures the Q&A portion", "meaningVi": "bao gồm phần hỏi đáp trực tiếp"}]},
                },
            },
        ],
    },

    # SET 5: TRIPLE PASSAGE (POLICY NOTICE + INVOICE + CUSTOMER EMAIL)
    {
        "id": "t1-p7-triple-1",
        "title": "Triple 1: Chính sách Giao hàng, Hóa đơn & Email Khiếu nại Nội thất",
        "passageCountType": "triple",
        "topic": "Đơn hàng, Hóa đơn & CSKH (Notice + Invoice + Email)",
        "passages": [
            {
                "id": "p7-t1-doc1", "tabLabel": "Passage 1: Policy Notice", "genre": "Notice",
                "title": "Crestline Office Furnishings — Updated Delivery & Return Policy",
                "headerMeta": [{"label": "Effective Date", "value": "January 1"}, {"label": "Applies To", "value": "All Commercial & Corporate Orders"}],
                "paragraphs": [
                    {"id": "p7-t1-p1", "sentences": [
                        {"id": "p7-t1-s1", "en": "Orders totaling $1,500 or more qualify for complimentary standard freight delivery and complimentary on-site assembly.",
                         "vi": "Các đơn hàng có tổng giá trị từ 1.500 đô la trở lên đủ điều kiện nhận giao hàng tiêu chuẩn miễn phí và lắp ráp tận nơi miễn phí."},
                        {"id": "p7-t1-s2", "en": "For orders under $1,500, a flat shipping fee of $120 applies, and optional assembly may be added for $75 per order.",
                         "vi": "Với đơn dưới 1.500 đô la, phí vận chuyển cố định là 120 đô la và dịch vụ lắp ráp tùy chọn là 75 đô la mỗi đơn."},
                    ]},
                    {"id": "p7-t1-p2", "sentences": [
                        {"id": "p7-t1-s3", "en": "Defective or transit-damaged furniture must be reported within 7 business days of delivery to receive a priority replacement at no charge.",
                         "vi": "Nội thất bị lỗi hoặc hư hỏng khi vận chuyển phải báo trong vòng 7 ngày làm việc kể từ ngày giao để được đổi mới ưu tiên miễn phí."},
                        {"id": "p7-t1-s4", "en": "Please note that custom-upholstered items are non-refundable unless damaged upon arrival.",
                         "vi": "Lưu ý hàng bọc vải đặt riêng không hoàn tiền trừ khi hư hỏng lúc giao tới."},
                    ]},
                ],
            },
            {
                "id": "p7-t1-doc2", "tabLabel": "Passage 2: Invoice", "genre": "Invoice / Form",
                "title": "Commercial Invoice #CR-8842",
                "headerMeta": [
                    {"label": "Client", "value": "Brightpath Design Studio (Attn: Kevin Cho)"},
                    {"label": "Order Date", "value": "February 4"},
                    {"label": "Delivery Date", "value": "February 10"},
                ],
                "tableData": {
                    "headers": ["Item Code", "Description", "Qty", "Unit Price", "Subtotal"],
                    "rows": [
                        {"id": "p7-t1-r1", "cells": ["ER-204", "AeroMesh Ergonomic Chair (Standard Black)", "4", "$260", "$1,040"], "viNote": "Ghế công thái học AeroMesh (4 x $260 = $1,040)"},
                        {"id": "p7-t1-r2", "cells": ["DK-510", "Adjustable Oak Standing Desk (60-inch)", "2", "$340", "$680"], "viNote": "Bàn đứng gỗ sồi điều chỉnh độ cao (2 x $340 = $680)"},
                        {"id": "p7-t1-r3", "cells": ["SV-001", "Standard Freight & On-Site Assembly", "1", "$120", "$120"], "viNote": "Phí giao hàng & lắp ráp ($120 — tính nhầm vì đơn > $1,500)"},
                    ],
                },
                "paragraphs": [
                    {"id": "p7-t1-p3", "sentences": [
                        {"id": "p7-t1-s5", "en": "Merchandise Subtotal: $1,720 | Shipping/Service Listed: $120 | Total Charged: $1,840.",
                         "vi": "Tạm tính hàng hóa: 1.720 đô la | Phí dịch vụ ghi hóa đơn: 120 đô la | Tổng đã thu: 1.840 đô la."},
                    ]},
                ],
            },
            {
                "id": "p7-t1-doc3", "tabLabel": "Passage 3: Customer Email", "genre": "Email",
                "title": "Email từ Khách hàng Kevin Cho",
                "headerMeta": [
                    {"label": "From", "value": "Kevin Cho <kcho@brightpathstudio.com>"},
                    {"label": "To", "value": "support@crestlinefurnishings.com"},
                    {"label": "Date", "value": "February 12"},
                    {"label": "Subject", "value": "Issues with Order #CR-8842"},
                ],
                "paragraphs": [
                    {"id": "p7-t1-p4", "sentences": [
                        {"id": "p7-t1-s6", "en": "Hello Support Team, Our furniture shipment arrived two days ago, and the delivery crew assembled all six pieces professionally. However, I noticed two problems after reviewing the paperwork and inspecting the items.",
                         "vi": "Xin chào Đội hỗ trợ, lô nội thất của chúng tôi đã đến cách đây hai ngày và đội giao hàng đã lắp ráp cả sáu món rất chuyên nghiệp. Tuy nhiên, tôi thấy hai vấn đề sau khi kiểm tra giấy tờ và sản phẩm."},
                        {"id": "p7-t1-s7", "en": "First, our invoice includes a shipping charge even though our furniture purchase exceeded your free-delivery threshold. Could you please issue a credit back to our corporate card for that fee?",
                         "vi": "Thứ nhất, hóa đơn tính phí vận chuyển dù giá trị đơn vượt ngưỡng miễn phí giao hàng. Quý công ty vui lòng hoàn khoản phí đó về thẻ công ty của chúng tôi?"},
                    ]},
                    {"id": "p7-t1-p5", "sentences": [
                        {"id": "p7-t1-s8", "en": "Second, one of the standing desks has a deep scratch along the front oak edge and its height-adjustment motor stalls halfway up. Photos are attached for your reference.",
                         "vi": "Thứ hai, một chiếc bàn đứng bị trầy sâu dọc cạnh gỗ sồi phía trước và mô-tơ nâng hạ bị khựng lại giữa chừng. Hình ảnh đã đính kèm."},
                        {"id": "p7-t1-s9", "en": "Please let me know how soon we can arrange a replacement unit, as our new graphic designer starts next Monday.",
                         "vi": "Vui lòng cho biết sớm nhất khi nào có thể sắp xếp chiếc bàn thay thế, vì nhà thiết kế đồ họa mới sẽ đi làm vào thứ Hai tới."},
                    ]},
                ],
            },
        ],
        "questions": [
            {
                "id": "p7-t1-q1", "questionNumber": 196, "questionType": "Thông tin chi tiết (Detail)",
                "prompt": "According to Passage 1, how much does on-site assembly cost for a $1,000 furniture order?",
                "options": {"A": "$0", "B": "$75", "C": "$120", "D": "$195"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Chi tiết bảng phí (Passage 1)", "signal": "Đơn $1,000 < $1,500 → kiểm tra phí 'optional assembly'."},
                    "translation": {"questionVi": "Theo Đoạn 1, phí lắp ráp tận nơi cho đơn $1,000 là bao nhiêu?", "optionsVi": {"A": "$0", "B": "$75", "C": "$120", "D": "$195"}},
                    "proof": {"explanation": "Đoạn 1 ghi: 'optional assembly may be added for $75 per order' cho đơn dưới $1,500.", "evidenceQuote": "optional assembly may be added for $75 per order.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-t1-s2"},
                    "wrongOptionsAnalysis": {"A": "Loại — Chỉ miễn phí khi ≥ $1,500.", "B": "ĐÚNG — $75 riêng phí lắp ráp.", "C": "Loại — $120 là phí ship.", "D": "Loại — $195 là tổng cả ship lẫn lắp ráp."},
                    "keyTakeaways": {"formula": "Đọc kỹ câu hỏi hỏi 1 loại phí hay tổng 2 loại phí.", "commonTrap": "Cộng gộp $120 + $75 = $195.", "paraphrases": [{"textInPassage": "orders under $1,500", "textInAnswer": "a $1,000 furniture order", "meaningVi": "đơn dưới 1.500 đô la"}]},
                },
            },
            {
                "id": "p7-t1-q2", "questionNumber": 197, "questionType": "Suy luận (Inference)",
                "prompt": "How much money is Mr. Cho requesting to be credited back to his company’s card?",
                "options": {"A": "$75", "B": "$120", "C": "$340", "D": "$1,720"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Suy luận liên kết cả 3 đoạn", "signal": "P3 đòi hoàn 'shipping charge' → Tra dòng SV-001 trên Hóa đơn P2 → $120!"},
                    "translation": {"questionVi": "Ông Cho yêu cầu hoàn lại bao nhiêu tiền về thẻ công ty?", "optionsVi": {"A": "$75", "B": "$120", "C": "$340", "D": "$1,720"}},
                    "proof": {"explanation": "Đơn hàng $1,720 vượt ngưỡng $1,500 (P1) nhưng vẫn bị tính $120 phí ship trên hóa đơn (P2), và ông Cho yêu cầu hoàn khoản phí này (P3).", "evidenceQuote": "Merchandise Subtotal: $1,720 | Shipping/Service Listed: $120", "evidencePassageIndex": 1, "evidenceSentenceId": "p7-t1-s5"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "ĐÚNG — $120 phí vận chuyển tính nhầm.", "C": "Loại — $340 là giá bàn đứng nhưng ông đòi đổi mới (replacement), không đòi hoàn tiền bàn.", "D": "Loại — Tổng tiền hàng."},
                    "keyTakeaways": {"formula": "Quy định (P1) + Số tiền (P2) + Yêu cầu (P3) = Chuẩn Triple Passage.", "commonTrap": "Chọn nhầm $340 giá chiếc bàn hỏng.", "paraphrases": [{"textInPassage": "issue a credit back", "textInAnswer": "credited back / refunded", "meaningVi": "hoàn tiền lại thẻ"}]},
                },
            },
            {
                "id": "p7-t1-q3", "questionNumber": 198, "questionType": "Suy luận (Inference)",
                "prompt": "Which item code corresponds to the product that Mr. Cho wants replaced?",
                "options": {"A": "ER-204", "B": "DK-510", "C": "SV-001", "D": "CR-8842"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Tra chéo Mã sản phẩm (P3 → P2)", "signal": "P3 báo hỏng 'standing desk ... oak edge' → Tra cột Item Code trên bảng P2."},
                    "translation": {"questionVi": "Mã sản phẩm nào tương ứng món hàng ông Cho muốn đổi mới?", "optionsVi": {"A": "ER-204 (Ghế)", "B": "DK-510 (Bàn đứng gỗ sồi)", "C": "SV-001 (Phí ship)", "D": "CR-8842 (Số hóa đơn)"}},
                    "proof": {"explanation": "P3 báo hỏng 'standing desks ... front oak edge' khớp với dòng DK-510 (Adjustable Oak Standing Desk) ở P2.", "evidenceQuote": "one of the standing desks has a deep scratch along the front oak edge", "evidencePassageIndex": 2, "evidenceSentenceId": "p7-t1-s8"},
                    "wrongOptionsAnalysis": {"A": "Loại — Ghế không hỏng.", "B": "ĐÚNG — DK-510.", "C": "Loại — Mã dịch vụ.", "D": "Loại — Số hóa đơn."},
                    "keyTakeaways": {"formula": "Mô tả hàng lỗi (Email) → Tra mã Item Code (Invoice).", "commonTrap": "Nhầm số hóa đơn CR-8842 là mã sản phẩm.", "paraphrases": [{"textInPassage": "height-adjustment motor", "textInAnswer": "Adjustable Standing Desk", "meaningVi": "bàn đứng điều chỉnh độ cao"}]},
                },
            },
            {
                "id": "p7-t1-q4", "questionNumber": 199, "questionType": "Loại trừ (NOT/TRUE)",
                "prompt": "Based on all three passages, why is Brightpath Design Studio eligible for a free priority replacement?",
                "options": {"A": "The damaged desk was custom-upholstered.", "B": "The company reported the defect within two days of delivery.", "C": "The delivery crew failed to assemble the furniture on site.", "D": "The studio placed a second bulk order for next Monday."},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Kết hợp mốc thời gian 3 đoạn", "signal": "P1: báo trong 7 ngày làm việc; P2: giao Feb 10; P3: báo lỗi Feb 12 (chỉ sau 2 ngày)."},
                    "translation": {"questionVi": "Dựa vào 3 đoạn, tại sao Brightpath Design Studio đủ điều kiện đổi ưu tiên miễn phí?", "optionsVi": {"A": "Bàn bọc vải đặt riêng", "B": "Báo lỗi trong vòng 2 ngày kể từ lúc giao", "C": "Đội giao hàng không lắp ráp", "D": "Đặt thêm đơn thứ hai"}},
                    "proof": {"explanation": "Giao Feb 10, báo lỗi Feb 12 (2 ngày) hoàn toàn nằm trong hạn 7 ngày làm việc quy định ở P1.", "evidenceQuote": "Defective or transit-damaged furniture must be reported within 7 business days of delivery to receive a priority replacement at no charge.", "evidencePassageIndex": 0, "evidenceSentenceId": "p7-t1-s3"},
                    "wrongOptionsAnalysis": {"A": "Loại.", "B": "ĐÚNG — 2 ngày < 7 ngày làm việc.", "C": "Loại — Đội giao hàng lắp rất chuyên nghiệp.", "D": "Loại."},
                    "keyTakeaways": {"formula": "Đối chiếu ngày giao (P2) ↔ ngày gửi email (P3) ↔ thời hạn (P1).", "commonTrap": "Không trừ ngày từ Feb 10 đến Feb 12.", "paraphrases": [{"textInPassage": "at no charge", "textInAnswer": "free", "meaningVi": "miễn phí"}]},
                },
            },
            {
                "id": "p7-t1-q5", "questionNumber": 200, "questionType": "Từ đồng nghĩa (Vocab in Context)",
                "prompt": "In Passage 3, paragraph 2, the word 'stalls' is closest in meaning to",
                "options": {"A": "accelerates", "B": "stops abruptly", "C": "displays", "D": "rotates"},
                "correctAnswer": "B",
                "explanation": {
                    "classification": {"category": "Part 7 — Từ đa nghĩa trong ngữ cảnh", "signal": "'height-adjustment motor stalls halfway up' (động cơ bị khựng/dừng đột ngột)."},
                    "translation": {"questionVi": "Động từ 'stalls' gần nghĩa nhất với cụm nào?", "optionsVi": {"A": "tăng tốc", "B": "dừng đột ngột", "C": "trưng bày (bẫy danh từ stall = gian hàng)", "D": "xoay vòng"}},
                    "proof": {"explanation": "Khi chủ ngữ là động cơ ('motor'), 'stall' nghĩa là chết máy, dừng khựng đột ngột ('stops abruptly').", "evidenceQuote": "its height-adjustment motor stalls halfway up.", "evidencePassageIndex": 2, "evidenceSentenceId": "p7-t1-s8"},
                    "wrongOptionsAnalysis": {"A": "Loại — Trái nghĩa.", "B": "ĐÚNG — motor stalls = stops abruptly.", "C": "Loại — Bẫy nghĩa danh từ 'gian hàng'.", "D": "Loại."},
                    "keyTakeaways": {"formula": "stall (n: gian hàng) ≠ stall (v: động cơ chết máy / khựng lại)", "commonTrap": "Hiểu theo nghĩa danh từ 'quầy hàng' rồi chọn C.", "paraphrases": [{"textInPassage": "motor stalls halfway up", "textInAnswer": "stops abruptly mid-way", "meaningVi": "dừng đột ngột giữa chừng"}]},
                },
            },
        ],
    },
]
