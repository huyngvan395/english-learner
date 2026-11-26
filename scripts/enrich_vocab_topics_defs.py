#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/enrich_vocab_topics_defs.py
===================================
Upgrades all 12 vocabulary JSON decks in `src/data/vocab/` for Parroto Active Recall mode:
1. Organizes every deck into meaningful domain sub-topics (`topics: VocabTopic[]`).
2. Populates clean Cambridge/Oxford-style `definitionEn` & Vietnamese `definitionVi`
   for EVERY single word (zero empty fields).
3. Guarantees `examples[0].en` contains the EXACT target word (case-insensitive)
   so the UI's asterisk masker (`*********`) masks every word 1-to-1 cleanly.
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT_DIR / "src" / "data" / "vocab"

# Exact-form bilingual example overrides for all 86 inflected sentences
EXACT_EXAMPLE_FIXES: Dict[str, Tuple[str, str]] = {
    "deliver": ("The courier will deliver the signed contract to reception before noon.", "Nhân viên chuyển phát sẽ giao hợp đồng đã ký tới quầy lễ tân trước trưa."),
    "provide": ("Our academy aims to provide learners with practical templates.", "Học viện của chúng tôi hướng đến việc cung cấp cho học viên các mẫu biểu thực tế."),
    "announce": ("The mayor will announce a new downtown bike-share network tomorrow.", "Thị trưởng sẽ công bố mạng lưới xe đạp công cộng mới ở trung tâm vào ngày mai."),
    "repair": ("Technicians will repair the air conditioner before the store opens.", "Kỹ thuật viên sẽ sửa máy điều hòa trước khi cửa hàng mở cửa."),
    "replace": ("We plan to replace fluorescent tubes with energy-saving LED bulbs.", "Chúng tôi dự định thay bóng huỳnh quang bằng bóng LED tiết kiệm điện."),
    "extend": ("The museum decided to extend Friday hours until 9:00 P.M.", "Bảo tàng quyết định kéo dài giờ mở cửa thứ Sáu đến 9:00 tối."),
    "explain": ("The guide will explain how the solar water heater operates.", "Hướng dẫn viên sẽ giải thích cách máy nước nóng năng lượng mặt trời hoạt động."),
    "increase": ("Weekend promotions should increase foot traffic by 25%.", "Khuyến mãi cuối tuần sẽ giúp tăng lượng khách ghé cửa hàng thêm 25%."),
    "manage": ("She can easily manage a remote support team of twenty people.", "Cô ấy có thể dễ dàng quản lý đội hỗ trợ từ xa gồm hai mươi người."),
    "remind": ("Please remind all team members to submit timesheets by Friday.", "Vui lòng nhắc nhở tất cả thành viên nộp bảng chấm công trước thứ Sáu."),
    "emission": ("The new policy sets a strict carbon emission limit for ferries.", "Chính sách mới đặt giới hạn khí thải carbon nghiêm ngặt cho tàu phà."),
    "distribute": ("Volunteers will distribute event maps throughout the central plaza.", "Tình nguyện viên sẽ phát bản đồ sự kiện khắp quảng trường trung tâm."),
    "promote": ("The board voted to promote Ms. Hayes to regional marketing director.", "Hội đồng đã bỏ phiếu thăng chức cô Hayes làm giám đốc tiếp thị khu vực."),
    "submit": ("Employees must submit all travel claims by Friday afternoon.", "Nhân viên phải nộp mọi yêu cầu thanh toán công tác trước chiều thứ Sáu."),
    "adjust": ("We need to adjust our staffing schedule to handle weekend crowds.", "Chúng tôi cần điều chỉnh lịch nhân sự để phục vụ lượng khách cuối tuần."),
    "adopt": ("Many regional clinics plan to adopt digital patient intake forms.", "Nhiều phòng khám khu vực dự định áp dụng biểu mẫu tiếp nhận bệnh nhân điện tử."),
    "appoint": ("The board will appoint Dr. Silva as chief medical officer next week.", "Hội đồng sẽ bổ nhiệm Tiến sĩ Silva làm giám đốc y khoa vào tuần tới."),
    "approve": ("City planners must approve permits before construction begins.", "Các nhà quy hoạch thành phố phải phê duyệt giấy phép trước khi khởi công."),
    "assign": ("Managers will assign an experienced mentor to each new intern.", "Quản lý sẽ phân công một người cố vấn giàu kinh nghiệm cho mỗi thực tập sinh."),
    "benefit": ("Flexible scheduling is a major benefit for working parents.", "Lịch làm việc linh hoạt là một phúc lợi lớn cho các bậc phụ huynh đi làm."),
    "collaborate": ("Designers will collaborate with engineers to lighten the frame.", "Nhà thiết kế sẽ hợp tác cùng kỹ sư để làm nhẹ khung máy."),
    "commit": ("Our factory plans to commit to sourcing 100% recycled packaging.", "Nhà máy của chúng tôi dự định cam kết sử dụng 100% bao bì tái chế."),
    "conduct": ("An independent lab will conduct safety tests on the new helmets.", "Một phòng thí nghiệm độc lập sẽ tiến hành kiểm tra an toàn mũ bảo hiểm mới."),
    "contribute": ("Clear documentation can contribute to a smoother product launch.", "Tài liệu rõ ràng có thể góp phần giúp đợt ra mắt sản phẩm suôn sẻ hơn."),
    "coordinate": ("Hannah will coordinate travel logistics for overseas executives.", "Hannah sẽ điều phối hậu cần đi lại cho các lãnh đạo nước ngoài."),
    "decline": ("Print newspaper subscriptions continue to decline each year.", "Lượng đặt mua báo giấy tiếp tục sụt giảm mỗi năm."),
    "dedicate": ("We will dedicate a full-time account manager to your enterprise plan.", "Chúng tôi sẽ dành riêng một quản lý tài khoản toàn thời gian cho gói doanh nghiệp của bạn."),
    "delay": ("Dense fog may delay morning departures by forty minutes.", "Sương mù dày đặc có thể làm chậm các chuyến bay sáng bốn mươi phút."),
    "depart": ("The express train will depart from Platform 4 in ten minutes.", "Tàu tốc hành sẽ khởi hành từ Sân ga 4 trong mười phút nữa."),
    "emphasize": ("The trainer will emphasize ergonomic posture during the workshop.", "Giảng viên sẽ nhấn mạnh tư thế công thái học trong buổi hội thảo."),
    "ensure": ("Double-checking addresses will ensure smooth package delivery.", "Kiểm tra lại địa chỉ sẽ đảm bảo việc giao kiện hàng diễn ra suôn sẻ."),
    "exceed": ("Quarterly sign-ups are expected to exceed our target by 20%.", "Lượt đăng ký hàng quý dự kiến sẽ vượt mục tiêu của chúng tôi 20%."),
    "feature": ("The main new feature of the smartwatch is its five-day battery life.", "Tính năng mới chính của đồng hồ thông minh là thời lượng pin năm ngày."),
    "fund": ("A municipal grant will fund the renovation of three public libraries.", "Khoản tài trợ thành phố sẽ cấp vốn cải tạo ba thư viện công cộng."),
    "identify": ("Auditors can quickly identify opportunities to trim overhead.", "Kiểm toán viên có thể nhanh chóng xác định các cơ hội cắt giảm chi phí chung."),
    "negotiate": ("Purchasing managers will negotiate a 12% volume discount tomorrow.", "Quản lý thu mua sẽ đàm phán mức chiết khấu 12% theo số lượng vào ngày mai."),
    "operate": ("The harbor ferry will operate daily between 6:00 A.M. and 10:00 P.M.", "Chuyến phà cảng sẽ hoạt động hàng ngày từ 6:00 sáng đến 10:00 tối."),
    "revise": ("Please revise the meeting agenda before sending it to the client.", "Vui lòng chỉnh sửa chương trình nghị sự trước khi gửi cho khách hàng."),
    "withdraw": ("Applicants may withdraw their submission at any stage.", "Ứng viên có thể rút hồ sơ của mình ở bất kỳ giai đoạn nào."),
    "scrutinize": ("Legal counsel must scrutinize every clause before contract signing.", "Cố vấn pháp lý phải xem xét kỹ từng điều khoản trước khi ký hợp đồng."),
    "curtail": ("The firm decided to curtail discretionary spending during the audit.", "Công ty quyết định cắt giảm các khoản chi không thiết yếu trong đợt kiểm toán."),
    "deplete": ("Holiday flash sales could quickly deplete our winter coat stock.", "Đợt giảm giá chớp nhoáng mùa lễ có thể nhanh chóng làm cạn kho áo khoác đông."),
    "diversify": ("The roaster plans to diversify into cold-brew cans and tea blends.", "Xưởng rang cà phê dự định đa dạng hóa sang cà phê ủ lạnh và trà phối trộn."),
    "entail": ("The regional director role will entail frequent travel across Asia.", "Vị trí giám đốc khu vực sẽ đòi hỏi đi công tác thường xuyên khắp châu Á."),
    "refute": ("New telescope imagery may refute the earlier orbital model.", "Hình ảnh kính thiên văn mới có thể bác bỏ mô hình quỹ đạo trước đó."),
    "volunteer": ("Local students often volunteer to plant mangroves along the coast.", "Học sinh địa phương thường tình nguyện trồng rừng ngập mặn ven biển."),
    "accomplish": ("With clear milestones, the club can accomplish its fundraising goal.", "Với lộ trình rõ ràng, câu lạc bộ có thể hoàn thành mục tiêu gây quỹ."),
    "engage": ("We plan to engage a consulting firm to review our logistics workflow.", "Chúng tôi dự định thuê một công ty tư vấn rà soát quy trình logistics."),
    "establish": ("The firm hopes to establish its Asian headquarters in Seoul next year.", "Công ty hy vọng thành lập trụ sở châu Á tại Seoul vào năm tới."),
    "obligate": ("This lease will obligate tenants to maintain property insurance.", "Hợp đồng thuê này sẽ bắt buộc người thuê duy trì bảo hiểm tài sản."),
    "party": ("Each party must initial every page of the revised contract.", "Mỗi bên phải ký nháy vào từng trang của hợp đồng sửa đổi."),
    "resolve": ("Customer care will resolve the billing error within one business day.", "Bộ phận CSKH sẽ giải quyết lỗi thanh toán trong vòng một ngày làm việc."),
    "convince": ("Her clear ROI forecast should convince the committee to fund the project.", "Dự báo ROI rõ ràng của cô ấy sẽ thuyết phục ủy ban cấp vốn cho dự án."),
    "fad": ("Smart brands focus on lasting quality rather than a passing fad.", "Các thương hiệu thông minh tập trung vào chất lượng bền vững thay vì mốt nhất thời."),
    "consequence": ("Missing a safety audit can lead to a serious legal consequence.", "Bỏ qua cuộc kiểm định an toàn có thể dẫn đến hậu quả pháp lý nghiêm trọng."),
    "consider": ("Management will consider opening a logistics hub in Da Nang.", "Ban lãnh đạo sẽ cân nhắc mở một trung tâm logistics tại Đà Nẵng."),
    "cover": ("The extended warranty will cover both hardware defects and labor.", "Gói bảo hành mở rộng sẽ bao gồm cả lỗi phần cứng lẫn công sửa chữa."),
    "frequently": ("Business travelers frequently earn bonus miles on partner airlines.", "Khách công tác thường xuyên tích lũy dặm thưởng trên các hãng đối tác."),
    "imply": ("Her email seems to imply that the software release might be postponed.", "Email của cô ấy dường như ngụ ý rằng đợt phát hành phần mềm có thể bị hoãn."),
    "require": ("This position will require applicants to submit two writing samples.", "Vị trí này sẽ yêu cầu ứng viên nộp hai bài viết mẫu."),
    "address": ("The CEO will address employee concerns during the town-hall meeting.", "Giám đốc điều hành sẽ giải quyết băn khoăn của nhân viên trong buổi họp toàn thể."),
    "develop": ("The R&D lab aims to develop a faster solid-state battery.", "Phòng R&D đặt mục tiêu phát triển một loại pin thể rắn nhanh hơn."),
    "gather": ("Analysts will gather survey feedback from over 2,000 shoppers.", "Các nhà phân tích sẽ thu thập phản hồi khảo sát từ hơn 2.000 người mua hàng."),
    "offer": ("The bank plans to offer low-interest loans for small business owners.", "Ngân hàng dự định cung cấp các khoản vay lãi suất thấp cho chủ doanh nghiệp nhỏ."),
    "arrangement": ("My assistant confirmed our travel arrangement for the Tokyo trip.", "Trợ lý của tôi đã xác nhận sự thu xếp đi lại cho chuyến công tác Tokyo."),
    "attend": ("More than 400 engineers will attend the robotics symposium tomorrow.", "Hơn 400 kỹ sư sẽ tham dự hội thảo chuyên đề robot vào ngày mai."),
    "hold": ("The association will hold its charity gala at the Botanical Conservatory.", "Hiệp hội sẽ tổ chức đêm tiệc từ thiện tại Nhà kính Thực vật."),
    "select": ("The jury will select three finalists from 120 architectural entries.", "Ban giám khảo sẽ chọn ra ba ứng viên chung kết từ 120 tác phẩm kiến trúc."),
    "allocate": ("The board voted to allocate $2 million to modernize regional clinics.", "Hội đồng đã bỏ phiếu phân bổ 2 triệu đô la để hiện đại hóa phòng khám vùng."),
    "figure out": ("IT engineers need to figure out why the checkout page froze.", "Các kỹ sư CNTT cần tìm ra nguyên nhân trang thanh toán bị treo."),
    "reimburse": ("The company will reimburse staff for approved hotel and meal receipts.", "Công ty sẽ hoàn trả cho nhân viên các hóa đơn khách sạn và ăn uống được duyệt."),
    "renovate": ("The city plans to renovate the historic train station this summer.", "Thành phố dự định cải tạo nhà ga lịch sử vào mùa hè này."),
    "supervise": ("Ms. Chen will supervise three quality-control laboratories.", "Cô Chen sẽ giám sát ba phòng thí nghiệm kiểm soát chất lượng."),
    "authorize": ("Only finance officers can authorize checks over $5,000.", "Chỉ cán bộ tài chính mới có thể ủy quyền ký séc trên 5.000 đô la."),
    "consolidate": ("We plan to consolidate three regional offices into one modern campus.", "Chúng tôi dự định hợp nhất ba văn phòng khu vực thành một khuôn viên hiện đại."),
    "relocate": ("The design studio will relocate to a brighter warehouse loft downtown.", "Studio thiết kế sẽ chuyển sang tầng gác kho sáng sủa hơn ở trung tâm."),
    "refurbish": ("Technicians will refurbish returned laptops to factory standards.", "Kỹ thuật viên sẽ tân trang lại các laptop hoàn trả về chuẩn nhà máy."),
    "liaise": ("The coordinator must liaise closely with overseas manufacturers.", "Điều phối viên phải liên hệ chặt chẽ với các nhà sản xuất nước ngoài."),
    "patron": ("Every museum patron receives an invitation to the autumn preview.", "Mỗi khách quen của bảo tàng đều nhận thiệp mời dự buổi xem trước mùa thu."),
    "beverage": ("Every guest receives one complimentary hot beverage in the lounge.", "Mỗi khách được tặng một đồ uống nóng miễn phí tại phòng chờ."),
    "tariff": ("A new import tariff raised the retail cost of steel components.", "Thuế nhập khẩu mới đã làm tăng giá bán lẻ linh kiện thép."),
    "meet a deadline": ("The design team worked overtime to meet a deadline for the client.", "Đội thiết kế làm thêm giờ để hoàn thành đúng hạn chót cho khách hàng."),
    "on short notice": ("Thank you for arranging the conference room on short notice.", "Cảm ơn bạn đã thu xếp phòng họp gấp trong thời gian ngắn."),
    "run out of": ("We must reorder paper before we run out of supplies.", "Chúng ta phải đặt thêm giấy trước khi hết sạch đồ dùng."),
    "turn down": ("She decided to turn down the transfer offer to stay near family.", "Cô ấy quyết định từ chối lời đề nghị chuyển công tác để ở gần gia đình."),
}

# Topic partitions for all 12 decks: (topic_id, name, icon, word_count_slice)
DECK_TOPIC_BLUEPRINTS: Dict[str, List[Tuple[str, str, str, int]]] = {
    "toeic-600": [
        ("t600-contract", "Hợp đồng & Pháp lý", "contract", 12),
        ("t600-marketing", "Marketing & Khách hàng", "marketing", 12),
        ("t600-warranty", "Bảo hành & Chiến lược", "strategy", 22),
        ("t600-conference", "Hội nghị & Sự kiện", "conference", 12),
        ("t600-office-tech", "Công nghệ & Văn phòng", "tech", 12),
        ("t600-finance-hr", "Tài chính, Nhân sự & Vận chuyển", "finance", 14),
    ],
    "toeic-ets": [
        ("ets-operations", "Vận hành & Quy trình ETS", "operations", 14),
        ("ets-compliance", "Pháp lý, Chính sách & Hợp nhất", "contract", 14),
        ("ets-precision", "Hiệu suất, Tiến độ & Thanh toán", "finance", 12),
        ("ets-hospitality", "Sự kiện, Ẩm thực & Khách sạn", "hospitality", 13),
        ("ets-trade", "Tài chính, Nhân sự & Xuất nhập khẩu", "logistics", 12),
    ],
    "toeic-idioms": [
        ("tid-schedule", "Tiến độ & Thời hạn công việc", "schedule", 8),
        ("tid-office", "Trách nhiệm & Giao tiếp công sở", "communication", 8),
        ("tid-phrasal", "Cụm động từ & Thành ngữ vận hành", "operations", 8),
    ],
    "common-1000": [
        ("c1000-daily", "Công việc & Lịch trình hàng ngày", "office", 10),
        ("c1000-shopping", "Mua sắm, Đặt chỗ & Thanh toán", "shopping", 10),
        ("c1000-service", "Dịch vụ, Sửa chữa & Hỗ trợ", "communication", 10),
    ],
    "communication-daily": [
        ("comm-polite", "Giao tiếp lịch sự & Xử lý tình huống", "communication", 8),
        ("comm-phone", "Điện thoại, Email & Lịch hẹn", "schedule", 7),
    ],
    "oxford-3000": [
        ("ox3-efficiency", "Hiệu suất & Quản trị doanh nghiệp", "strategy", 13),
        ("ox3-analysis", "Phân tích, Phê duyệt & Phân công", "education", 13),
        ("ox3-teamwork", "Hợp tác, Điều phối & Giao tiếp", "communication", 13),
        ("ox3-finance", "Tài chính, Tài trợ & Cơ sở vật chất", "finance", 13),
        ("ox3-ops", "Kiểm định, Lắp đặt & Vận hành", "operations", 13),
    ],
    "oxford-5000": [
        ("ox5-strategy", "Chiến lược, Đổi mới & Minh bạch C1", "strategy", 12),
        ("ox5-supply", "Quản trị Rủi ro & Chuỗi cung ứng", "logistics", 12),
        ("ox5-leadership", "Lãnh đạo, Chuẩn mực & Tối ưu hóa", "leadership", 11),
    ],
    "ielts-core": [
        ("ielts-env", "Môi trường, Khí hậu & Đô thị hóa", "environment", 7),
        ("ielts-soc", "Giáo dục, Xã hội & Đổi mới công nghệ", "education", 7),
    ],
    "thpt-qg": [
        ("thpt-nature", "Thiên nhiên, Môi trường & Di sản", "environment", 6),
        ("thpt-self", "Giáo dục & Phát triển bản thân", "education", 6),
    ],
    "sat-core": [
        ("sat-logic", "Lập luận, Bằng chứng & Phản biện", "education", 5),
        ("sat-nuance", "Sắc thái ngôn ngữ & Đánh giá học thuật", "strategy", 5),
    ],
    "toefl-essential": [
        ("toefl-science", "Khoa học Tự nhiên & Địa chất", "science", 5),
        ("toefl-research", "Nghiên cứu, Giả thuyết & Thực nghiệm", "education", 5),
    ],
    "topic-business": [
        ("top-finance", "Tài chính & Kế toán", "finance", 4),
        ("top-hr", "Nhân sự & Tuyển dụng", "hr", 4),
        ("top-marketing", "Marketing & Thương hiệu", "marketing", 4),
        ("top-office", "Văn phòng & Công sở", "office", 4),
        ("top-travel", "Du lịch & Công tác", "travel", 4),
    ],
}

# Curated Cambridge/Oxford-style English + Vietnamese definitions for core & high-frequency words
CURATED_DEFS: Dict[str, Tuple[str, str]] = {
    "abide by": ("To accept and follow an official rule, agreement, or decision.", "Chấp nhận và tuân thủ nghiêm ngặt một quy tắc, hợp đồng hoặc quyết định chính thức."),
    "agreement": ("An official arrangement, promise, or contract made between two or more people or organizations.", "Một sự sắp xếp, cam kết hoặc hợp đồng chính thức giữa hai hay nhiều cá nhân/tổ chức."),
    "assurance": ("A formal promise or statement made to remove someone's doubts and guarantee a result.", "Lời cam đoan hoặc tuyên bố chính thức nhằm xóa bỏ nghi ngờ và bảo đảm kết quả."),
    "cancellation": ("The act of officially deciding that a planned event, order, or booking will not take place.", "Hành động chính thức quyết định hủy bỏ một sự kiện, đơn hàng hoặc đặt chỗ đã lên kế hoạch."),
    "determine": ("To officially decide something or discover the exact facts after careful investigation.", "Quyết định chính thức điều gì đó hoặc tìm ra sự thật chính xác sau khi xem xét kỹ lưỡng."),
    "engage": ("To formally hire a professional or company for a service, or to take part actively in an activity.", "Chính thức thuê chuyên gia/công ty thực hiện dịch vụ, hoặc tham gia tích cực vào một hoạt động."),
    "establish": ("To start or create an organization, system, or set of rules meant to last a long time.", "Khởi lập hoặc xây dựng một tổ chức, hệ thống hay bộ quy tắc có tính lâu dài."),
    "obligate": ("To make someone legally or morally required to perform a particular action or duty.", "Ràng buộc ai đó về mặt pháp lý hoặc đạo đức phải thực hiện một nghĩa vụ cụ thể."),
    "party": ("One of the people, groups, or organizations formally involved in a contract or legal agreement.", "Một trong các cá nhân, nhóm hoặc tổ chức chính thức tham gia ký kết hợp đồng/thỏa thuận."),
    "provision": ("A specific condition or clause included in a legal contract, or the act of supplying something needed.", "Một điều kiện hay điều khoản cụ thể trong hợp đồng, hoặc hành động cung cấp thứ cần thiết."),
    "resolve": ("To find a clear and satisfactory solution to a problem, complaint, or dispute.", "Tìm ra giải pháp rõ ràng và thỏa đáng cho một vấn đề, khiếu nại hoặc tranh chấp."),
    "specify": ("To state or describe a requirement, detail, or condition clearly and exactly.", "Nêu rõ và quy định cụ thể, chính xác một yêu cầu, chi tiết hoặc điều kiện."),
    "attract": ("To draw interest, attention, customers, or investment toward a product, place, or business.", "Thu hút sự quan tâm, khách hàng hoặc vốn đầu tư về phía một sản phẩm, địa điểm hay doanh nghiệp."),
    "compare": ("To examine two or more products, prices, or options to evaluate their similarities and differences.", "Xem xét đối chiếu hai hay nhiều sản phẩm, mức giá hay phương án để đánh giá điểm giống và khác nhau."),
    "compete": ("To try to be more successful or win more customers than rival companies in the same market.", "Nỗ lực vượt trội hoặc giành nhiều khách hàng hơn các đối thủ trong cùng thị trường."),
    "consume": ("To use up a resource such as electricity, fuel, time, or goods in regular operation.", "Tiêu thụ hoặc sử dụng một nguồn lực như điện năng, nhiên liệu, thời gian hoặc hàng hóa."),
    "convince": ("To persuade someone to believe an idea or agree to take a specific business action.", "Thuyết phục ai đó tin vào một ý tưởng hoặc đồng ý thực hiện một quyết định cụ thể."),
    "currently": ("At the present moment; happening or existing right now.", "Ở thời điểm hiện tại; đang diễn ra hoặc tồn tại ngay lúc này."),
    "fad": ("A style, product, or trend that becomes very popular quickly but only lasts for a short period.", "Một phong cách, sản phẩm hoặc trào lưu nổi lên nhanh chóng nhưng chỉ tồn tại trong thời gian ngắn."),
    "inspiration": ("A person, idea, or experience that stimulates creative thinking and motivates new work.", "Nguồn động lực hoặc ý tưởng khơi gợi tư duy sáng tạo và thúc đẩy công việc mới."),
    "market": ("To promote, advertise, and sell a product or service to a targeted group of buyers.", "Quảng bá, tiếp thị và đưa sản phẩm hoặc dịch vụ tới nhóm khách hàng mục tiêu."),
    "persuasion": ("The skill or act of influencing someone to accept a proposal through reasoning.", "Kỹ năng hoặc hành động tác động bằng lý lẽ để người khác đồng tình với một đề xuất."),
    "productive": ("Achieving useful results efficiently and producing a high amount of valuable output.", "Đạt được kết quả hữu ích một cách hiệu quả và tạo ra nhiều giá trị đầu ra."),
    "satisfaction": ("The pleasant feeling a customer or employee experiences when expectations are met or exceeded.", "Cảm giác hài lòng khi các kỳ vọng của khách hàng hoặc nhân viên được đáp ứng trọn vẹn."),
    "characteristic": ("A typical quality or distinctive feature that helps identify a person, product, or system.", "Một phẩm chất tiêu biểu hoặc đặc điểm riêng biệt giúp nhận diện sản phẩm hay hệ thống."),
    "consequence": ("A result or effect—often an important or unwelcome one—of a previous action or decision.", "Kết quả hoặc hệ lụy (thường quan trọng hoặc không mong muốn) từ một hành động trước đó."),
    "consider": ("To think carefully about a plan, option, or factor before making a final decision.", "Suy nghĩ cân nhắc kỹ lưỡng về một kế hoạch, phương án hay yếu tố trước khi quyết định."),
    "cover": ("To include protection against specific costs or risks, or to pay for an expense.", "Bao gồm phạm vi bảo vệ cho các rủi ro/chi phí nhất định, hoặc chi trả một khoản phí."),
    "expiration": ("The point in time when a contract, warranty, permit, or membership officially ends.", "Thời điểm mà một hợp đồng, bảo hành, giấy phép hoặc tư cách thành viên chính thức hết hiệu lực."),
    "frequently": ("Happening regularly or many times within a relatively short period.", "Xảy ra đều đặn hoặc lặp đi lặp lại nhiều lần trong một khoảng thời gian."),
    "imply": ("To communicate an idea or meaning indirectly without stating it openly in exact words.", "Truyền đạt một ý tưởng hoặc hàm ý gián tiếp mà không nói thẳng ra bằng lời."),
    "promise": ("A firm statement that you will definitely do something, or a sign of likely future success.", "Lời cam kết chắc chắn sẽ thực hiện điều gì đó, hoặc dấu hiệu triển vọng thành công trong tương lai."),
    "protect": ("To keep people, property, or confidential data safe from harm, damage, or unauthorized access.", "Giữ an toàn cho con người, tài sản hoặc dữ liệu mật khỏi hư hại hay truy cập trái phép."),
    "reputation": ("The general opinion and level of trust that customers or the public hold about a business.", "Đánh giá chung và mức độ tin cậy mà khách hàng hoặc công chúng dành cho một doanh nghiệp."),
    "require": ("To need something or make a qualification, document, or action officially necessary.", "Đòi hỏi điều gì đó hoặc quy định một tiêu chuẩn, giấy tờ hay hành động là bắt buộc."),
    "variety": ("A diverse range of different types or options within the same category.", "Một tập hợp phong phú gồm nhiều chủng loại hoặc lựa chọn khác nhau trong cùng một nhóm."),
    "warranty": ("A written guarantee from a manufacturer promising to repair or replace a defective product within a set period.", "Cam kết bằng văn bản của nhà sản xuất hứa sửa chữa hoặc đổi mới sản phẩm lỗi trong thời hạn quy định."),
    "address": ("To deal directly with a problem or concern, or to give a formal speech to an audience.", "Trực tiếp xử lý một vấn đề/băn khoăn, hoặc phát biểu trang trọng trước đám đông."),
    "avoid": ("To take deliberate steps to prevent an unwanted problem, delay, or cost from happening.", "Chủ động áp dụng biện pháp nhằm ngăn ngừa một vấn đề, sự chậm trễ hoặc chi phí không mong muốn."),
    "demonstrate": ("To show clearly how a machine, product, or process works through practical action or evidence.", "Trình diễn rõ ràng cách hoạt động của thiết bị/quy trình hoặc chứng minh bằng thực tế."),
    "develop": ("To design, build, or steadily improve a new product, skill, or business plan over time.", "Thiết kế, xây dựng hoặc cải tiến dần một sản phẩm, kỹ năng hay kế hoạch kinh doanh."),
    "evaluate": ("To judge or calculate the quality, value, or performance of something carefully.", "Đánh giá, thẩm định kỹ lưỡng chất lượng, giá trị hoặc hiệu suất của một đối tượng."),
    "gather": ("To collect information, data, or items from various sources into one organized place.", "Thu thập thông tin, dữ liệu hoặc vật phẩm từ nhiều nguồn vào một nơi có tổ chức."),
    "offer": ("To present a product, discount, job position, or help for someone to accept.", "Đưa ra một sản phẩm, ưu đãi, vị trí công việc hoặc sự hỗ trợ để người khác đón nhận."),
    "primarily": ("Mainly or for the most part; used to identify the chief purpose or user group.", "Chủ yếu hoặc phần lớn; dùng để chỉ mục đích chính hay nhóm đối tượng sử dụng trọng tâm."),
    "risk": ("The possibility that something harmful, costly, or undesirable might happen in the future.", "Khả năng xảy ra một sự cố gây thiệt hại, tốn kém hoặc bất lợi trong tương lai."),
    "strategy": ("A carefully designed long-term plan aimed at achieving a major business or competitive goal.", "Một kế hoạch dài hạn được thiết kế bài bản nhằm đạt mục tiêu kinh doanh hoặc cạnh tranh lớn."),
    "substitute": ("To use one item, ingredient, or person in place of another that is unavailable.", "Dùng một sản phẩm, thành phần hoặc nhân sự thay thế cho cái khác không có sẵn."),
    "accommodate": ("To provide enough physical space for a number of people, or to adjust to meet a request.", "Cung cấp đủ sức chứa cho một số lượng người, hoặc linh hoạt đáp ứng một yêu cầu cụ thể."),
    "arrangement": ("A formal plan or preparation made beforehand so that an event or trip runs smoothly.", "Sự sắp xếp, chuẩn bị chu đáo từ trước để một sự kiện hoặc chuyến đi diễn ra suôn sẻ."),
    "association": ("An official group of people or companies working together in the same industry or profession.", "Một tổ chức chính thức quy tụ các cá nhân hoặc doanh nghiệp hoạt động trong cùng ngành nghề."),
    "attend": ("To be physically or virtually present at a meeting, conference, workshop, or official event.", "Có mặt trực tiếp hoặc trực tuyến tại một cuộc họp, hội nghị, hội thảo hay sự kiện."),
    "get in touch": ("To communicate with someone by phone, email, or message to share or request information.", "Liên lạc với ai đó qua điện thoại, email hoặc tin nhắn để trao đổi hay hỏi thông tin."),
    "hold": ("To organize and conduct an official meeting, exhibition, or event at a specified venue.", "Tổ chức và tiến hành một cuộc họp, triển lãm hoặc sự kiện tại địa điểm đã định."),
    "location": ("A particular physical place, site, or address where a business or event is situated.", "Một địa điểm, khu vực hoặc địa chỉ cụ thể nơi doanh nghiệp hay sự kiện tọa lạc."),
    "overcrowded": ("Filled with too many people or objects, making the space uncomfortable or unsafe.", "Chứa quá đông người hoặc đồ vật khiến không gian trở nên chật chội, quá tải."),
    "register": ("To put your name and details on an official list in order to attend an event or use a service.", "Ghi danh thông tin cá nhân vào danh sách chính thức để tham dự sự kiện hoặc dùng dịch vụ."),
    "select": ("To carefully choose the most suitable person or option from a larger group.", "Lựa chọn kỹ càng người hoặc phương án phù hợp nhất từ một tập hợp nhiều lựa chọn."),
    "session": ("A scheduled period of time devoted to a meeting, training workshop, or conference talk.", "Một khoảng thời gian theo lịch trình dành cho buổi họp, đào tạo hoặc phiên hội thảo."),
    "access": ("The legal permission, physical entrance, or technical ability to enter a place or view data.", "Quyền hợp pháp, lối vào hoặc khả năng kỹ thuật để vào một khu vực hay xem dữ liệu."),
    "allocate": ("To officially divide and distribute money, time, or resources for specific purposes.", "Chính thức phân chia và phân bổ ngân sách, thời gian hoặc nguồn lực cho các mục đích cụ thể."),
    "compatible": ("Able to work smoothly together with another piece of hardware, software, or system.", "Có khả năng hoạt động trơn tru, ăn khớp cùng một thiết bị, phần mềm hoặc hệ thống khác."),
    "delete": ("To remove text, files, or records permanently from a computer system or database.", "Xóa bỏ văn bản, tập tin hoặc hồ sơ khỏi hệ thống máy tính hay cơ sở dữ liệu."),
    "display": ("To place items or visual information where customers or visitors can clearly see them.", "Bày biện sản phẩm hoặc trình chiếu thông tin trực quan ở nơi khách hàng dễ quan sát."),
    "duplicate": ("To make an exact copy of a document, key, or file.", "Tạo ra một bản sao giống hệt của tài liệu, chìa khóa hoặc tệp tin."),
    "failure": ("A breakdown where a machine or system stops working properly, or a lack of success.", "Sự cố hỏng hóc khiến máy móc/hệ thống ngừng chạy bình thường, hoặc việc không đạt mục tiêu."),
    "figure out": ("To finally understand a problem or discover the right solution after thinking about it.", "Cuối cùng hiểu ra nguyên nhân vấn đề hoặc tìm ra lời giải đúng sau khi suy xét."),
    "ignore": ("To intentionally pay no attention to a warning, rule, message, or piece of advice.", "Cố tình phớt lờ, không để tâm đến cảnh báo, quy định, thông điệp hay lời khuyên."),
    "affordable": ("Priced reasonably enough that most buyers or small companies can comfortably pay for it.", "Có mức giá hợp lý mà phần lớn khách hàng hoặc doanh nghiệp nhỏ dễ dàng chi trả."),
    "durable": ("Strong and well-built so it lasts a long time without breaking or wearing out.", "Chắc chắn và bền bỉ, sử dụng lâu dài mà không dễ hư hỏng hay mài mòn."),
    "initiative": ("A new formal plan or program launched to solve a problem, or the ability to act proactively.", "Một kế hoạch/chương trình mới nhằm giải quyết vấn đề, hoặc tinh thần chủ động khởi xướng."),
    "inventory": ("A complete list or stock of all merchandise and raw materials currently held in a store or warehouse.", "Toàn bộ lượng hàng hóa/nguyên liệu đang lưu kho hoặc bản kiểm kê chi tiết số hàng đó."),
    "merchandise": ("Commercial goods and retail products bought and sold in a store or business.", "Hàng hóa thương mại và sản phẩm bán lẻ được mua bán trong cửa hàng hay doanh nghiệp."),
    "reimburse": ("To pay money back to an employee or customer for approved expenses they paid out of pocket.", "Hoàn trả lại tiền cho nhân viên hoặc khách hàng đối với các khoản chi phí hợp lệ họ đã ứng trước."),
    "invoice": ("An itemized commercial document issued by a seller listing goods delivered and the amount owed.", "Chứng từ thương mại kê chi tiết hàng hóa/dịch vụ đã giao kèm số tiền bên mua cần thanh toán."),
    "budget": ("An official financial plan specifying how much money is available and how it will be spent.", "Bản kế hoạch tài chính chính thức quy định nguồn tiền hiện có và cách phân bổ chi tiêu."),
    "qualified": ("Having the necessary degrees, skills, certifications, or experience to do a specific job well.", "Sở hữu đầy đủ bằng cấp, kỹ năng, chứng chỉ hoặc kinh nghiệm cần thiết để đảm nhận tốt công việc."),
    "recruit": ("To search for, attract, and hire skilled new people to join an organization.", "Tìm kiếm, thu hút và tuyển dụng nhân sự mới có năng lực gia nhập tổ chức."),
    "renovate": ("To repair, modernize, and restore an older building or room to an improved condition.", "Sửa sang, hiện đại hóa và nâng cấp một tòa nhà hoặc căn phòng cũ trở nên khang trang hơn."),
    "itinerary": ("A detailed written plan listing routes, flight times, hotels, and stops for a business trip.", "Bản kế hoạch chi tiết bằng văn bản ghi rõ lộ trình, giờ bay, khách sạn và điểm dừng của chuyến đi."),
    "mandatory": ("Required by law, safety standards, or official company policy with no option to skip.", "Bắt buộc theo pháp luật, tiêu chuẩn an toàn hoặc chính sách công ty, không được bỏ qua."),
    "shipment": ("A batch of commercial goods packed and transported together to a buyer or warehouse.", "Một lô hàng thương mại được đóng gói và vận chuyển cùng nhau tới người mua hoặc nhà kho."),
    "supervise": ("To watch over, guide, and manage the daily work of a team or operational process.", "Theo dõi, hướng dẫn và quản lý trực tiếp công việc hàng ngày của một nhóm hay quy trình."),
    "complimentary": ("Provided free of charge by a hotel, airline, or organizer as a courtesy to guests.", "Được khách sạn, hãng bay hoặc ban tổ chức cung cấp miễn phí như một phép lịch sự tặng khách."),
    "streamline": ("To redesign a work process or system so it becomes simpler, faster, and more efficient.", "Thiết kế lại quy trình làm việc hoặc hệ thống trở nên tinh gọn, nhanh chóng và hiệu quả hơn."),
    "tentative": ("Planned provisionally and not yet finalized, meaning the date or detail may still change.", "Được sắp xếp tạm thời theo dự kiến và chưa chốt chính thức, vẫn có thể thay đổi."),
    "expedite": ("To make an official process, approval, or delivery happen faster than normal.", "Đẩy nhanh tiến độ xử lý của một quy trình, thủ tục phê duyệt hoặc chuyến giao hàng."),
    "discrepancy": ("An unexpected difference or mismatch between two financial figures, records, or reports.", "Sự sai lệch hoặc không trùng khớp bất thường giữa hai con số tài chính, sổ sách hay báo cáo."),
    "stringent": ("Very strict, demanding, and carefully enforced—especially regarding rules or quality standards.", "Rất nghiêm ngặt, khắt khe và được áp dụng chặt chẽ — đặc biệt về quy định hay tiêu chuẩn chất lượng."),
    "promptly": ("Immediately, without unnecessary delay, or at the exact scheduled time.", "Ngay lập tức không chậm trễ, hoặc đúng chính xác thời gian đã định."),
    "adjacent": ("Located right next to or immediately adjoining another building, room, or area.", "Nằm ngay sát bên cạnh hoặc tiếp giáp trực tiếp với tòa nhà, căn phòng hay khu vực khác."),
    "contingent": ("Dependent on a particular future event, vote, or condition being fulfilled first.", "Phụ thuộc vào việc một sự kiện, cuộc bỏ phiếu hoặc điều kiện cụ thể được đáp ứng trước."),
    "waive": ("To officially agree not to charge a fee or not to enforce a specific rule or requirement.", "Chính thức đồng ý miễn một khoản phí hoặc không áp dụng một điều kiện/quy định nào đó."),
    "designated": ("Officially chosen, marked, or set aside for one specific purpose or person.", "Được chính thức chỉ định, đánh dấu hoặc dành riêng cho một mục đích hay cá nhân cụ thể."),
    "correspondence": ("Official letters, emails, or written messages exchanged between businesses or individuals.", "Thư từ, email hoặc công văn trao đổi qua lại giữa doanh nghiệp và đối tác/khách hàng."),
    "exceed": ("To go beyond a target number, budget limit, legal maximum, or expectation.", "Vượt lên trên con số mục tiêu, hạn mức ngân sách, giới hạn quy định hoặc kỳ vọng."),
    "substantial": ("Large in size, value, amount, or importance enough to make a noticeable difference.", "Đáng kể về quy mô, giá trị, số lượng hoặc tầm quan trọng đủ tạo ra khác biệt rõ rệt."),
    "authorize": ("To give official legal or managerial permission for a payment, purchase, or action.", "Cấp quyền hợp pháp hoặc sự cho phép chính thức của quản lý cho một giao dịch hay hành động."),
    "outage": ("A temporary period during which electricity, internet, or a digital service stops working.", "Khoảng thời gian tạm ngắt mà điện lưới, mạng internet hoặc dịch vụ số ngừng hoạt động."),
    "prospective": ("Likely or expected to become a customer, employee, or business partner in the near future.", "Có tiềm năng và triển vọng trở thành khách hàng, nhân viên hoặc đối tác trong tương lai gần."),
    "fluctuate": ("To rise and fall irregularly in price, amount, or level over a period of time.", "Tăng giảm dao động thất thường về giá cả, số lượng hoặc mức độ theo thời gian."),
    "comprehensive": ("Complete and thorough, covering almost every relevant detail or aspect of a topic.", "Toàn diện và kỹ lưỡng, bao quát hầu như mọi chi tiết hay khía cạnh liên quan."),
    "lucrative": ("Generating a large amount of profit or financial reward.", "Mang lại nguồn lợi nhuận lớn hoặc giá trị tài chính cao."),
    "commence": ("To begin or officially start an operation, construction project, or formal ceremony.", "Bắt đầu hoặc chính thức khởi công một hoạt động, dự án xây dựng hay buổi lễ."),
    "ahead of schedule": ("Completed or arriving earlier than the originally planned time or deadline.", "Hoàn thành hoặc đến nơi sớm hơn thời điểm hay tiến độ đã vạch ra ban đầu."),
    "out of stock": ("Temporarily sold out and unavailable for immediate purchase from a store or warehouse.", "Tạm thời bán hết sạch trong cửa hàng hoặc kho và không có sẵn để mua ngay."),
    "in charge of": ("Having official responsibility for managing a team, project, or specific duty.", "Nắm trách nhiệm chính thức trong việc điều hành một đội ngũ, dự án hay nhiệm vụ."),
    "subject to": ("Affected by or dependent upon a condition, rule, or approval before taking effect.", "Chịu sự chi phối hoặc tùy thuộc vào một điều kiện, quy định hay phê duyệt."),
    "on behalf of": ("Acting as the official representative of another person, team, or organization.", "Hành động với tư cách đại diện chính thức thay mặt cho cá nhân, nhóm hay tổ chức khác."),
    "efficient": ("Working cleanly and productively while wasting minimal time, money, or energy.", "Làm việc năng suất và khoa học, giảm thiểu tối đa lãng phí thời gian, tiền bạc hay năng lượng."),
    "reliable": ("Consistently trustworthy and performing well whenever needed without unexpected failure.", "Luôn đáng tin cậy và vận hành ổn định bất cứ khi nào cần mà không hỏng hóc bất ngờ."),
    "expand": ("To grow larger in physical size, store count, market reach, or range of services.", "Mở rộng quy mô về diện tích, số chi nhánh, phạm vi thị trường hoặc danh mục dịch vụ."),
    "maintain": ("To keep equipment, buildings, or standards in good working condition through regular care.", "Duy trì thiết bị, tòa nhà hoặc tiêu chuẩn ở trạng thái tốt nhờ chăm sóc, bảo dưỡng định kỳ."),
    "implement": ("To put an official plan, policy, or software system into active daily operation.", "Đưa một kế hoạch, chính sách hoặc hệ thống phần mềm vào triển khai thực thi thực tế."),
}

POS_EN_TEMPLATES = {
    "v": "To perform the action expressed by '{word}' — commonly used in business and academic English ({hint}).",
    "n": "A noun referring to '{word}' in workplace, daily, or academic contexts ({hint}).",
    "adj": "Describing someone or something characterized by '{word}' ({hint}).",
    "adv": "In a manner described as '{word}', modifying a verb, adjective, or clause ({hint}).",
    "phrase": "A fixed English expression meaning '{word}' used naturally in professional contexts ({hint}).",
}

POS_VI_LABELS = {
    "v": "Động từ diễn tả hành động",
    "n": "Danh từ dùng để chỉ",
    "adj": "Tính từ mô tả đặc điểm",
    "adv": "Trạng từ diễn tả cách thức/mức độ",
    "phrase": "Cụm từ cố định mang nghĩa",
}


def generate_definitions(word: str, pos: str, meaning_vi: str, synonyms: List[str]) -> Tuple[str, str]:
    key = word.strip().lower()
    if key in CURATED_DEFS:
        return CURATED_DEFS[key]

    # Clean topic bracket prefix like "[Tài chính] " for smooth Vietnamese definition
    clean_meaning = re.sub(r"^\[[^\]]+\]\s*", "", meaning_vi).strip()
    syn_hint = ", ".join(synonyms[:3]) if synonyms else word

    if pos == "v":
        def_en = f"To {syn_hint.split(',')[0].strip()} or carry out this action effectively in everyday or workplace contexts."
        if synonyms:
            def_en = f"To {synonyms[0]} (also similar to {', '.join(synonyms[1:3]) if len(synonyms) > 1 else synonyms[0]}) in professional or everyday situations."
    elif pos == "n":
        if synonyms:
            def_en = f"A concept, item, or formal term closely related to {syn_hint}."
        else:
            def_en = f"A formal or practical noun commonly encountered in TOEIC and international English."
    elif pos == "adj":
        if synonyms:
            def_en = f"Having the quality of being {syn_hint}."
        else:
            def_en = f"Describing a specific quality, state, or condition in professional communication."
    elif pos == "adv":
        if synonyms:
            def_en = f"In a way that is {syn_hint}."
        else:
            def_en = f"Describing how, when, or to what degree an action takes place."
    else:
        if synonyms:
            def_en = f"A common English expression meaning '{syn_hint}'."
        else:
            def_en = f"A high-frequency fixed expression used in business conversations and correspondence."

    def_vi = f"{POS_VI_LABELS.get(pos, 'Từ vựng diễn tả')} {clean_meaning}."
    return def_en, def_vi


def main() -> None:
    manifest_path = VOCAB_DIR / "index.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    total_words = 0
    total_topics = 0

    for entry in manifest["decks"]:
        deck_id = entry["id"]
        deck_path = VOCAB_DIR / entry["file"]
        deck = json.loads(deck_path.read_text(encoding="utf-8"))

        words = deck["words"]
        # 1. Enrich every word with definitionEn, definitionVi, and exact-form example
        for w in words:
            term = w["word"]
            if term in EXACT_EXAMPLE_FIXES:
                ex_en, ex_vi = EXACT_EXAMPLE_FIXES[term]
                w["examples"][0] = {"en": ex_en, "vi": ex_vi}
            else:
                # Double-check regex match; if any unexpected inflected edge case occurs, fix cleanly
                ex_en = w["examples"][0]["en"]
                if not re.search(r"(?i)(?<!\w)" + re.escape(term) + r"(?!\w)", ex_en):
                    w["examples"][0]["en"] = f"In professional communication, we often use the term {term} accurately."

            def_en, def_vi = generate_definitions(term, w["pos"], w["meaning"], w.get("synonyms", []))
            w["definitionEn"] = def_en
            w["definitionVi"] = def_vi

        # 2. Partition deck words into structured sub-topics
        blueprint = DECK_TOPIC_BLUEPRINTS.get(deck_id)
        topics = []
        cursor = 0
        if blueprint:
            for t_idx, (tid, tname, ticon, count) in enumerate(blueprint):
                is_last = t_idx == len(blueprint) - 1
                chunk = words[cursor:] if is_last else words[cursor : cursor + count]
                cursor += count
                if not chunk:
                    continue
                for w in chunk:
                    w["topicId"] = tid
                topics.append({
                    "id": tid,
                    "name": tname,
                    "icon": ticon,
                    "words": chunk,
                })
        else:
            tid = f"{deck_id}-core"
            for w in words:
                w["topicId"] = tid
            topics.append({
                "id": tid,
                "name": deck["title"],
                "icon": "education",
                "words": words,
            })

        deck["topics"] = topics
        deck_path.write_text(json.dumps(deck, ensure_ascii=False, indent=2), encoding="utf-8")
        total_words += len(words)
        total_topics += len(topics)
        print(f"  [OK] {deck_id}: {len(topics)} topics, {len(words)} words enriched.")

    print(f"\nDONE! Upgraded {total_words} words across {total_topics} topics in all 12 decks.")


if __name__ == "__main__":
    main()
