#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/clean_vocab_relations.py
================================
Scans all 16 vocab deck JSON files in public/data/vocab/ and search-index.json to:
1. Enforce STRICT same-root morphological filtering on `wordFamily` (using NLTK WordNet
   exact-lemma `derivationally_related_forms()` + SnowballStemmer / morphological root check)
   so unrelated synset words (e.g., `groom`, `prepare` inside `training`) are 100% eliminated.
2. Perform POS-aware Vietnamese meaning lookup: prioritize `(word, pos)` matches in both
   curated TOEIC glosses and the internal 10,996-word bank before falling back to bare `word`.
3. For verbs (`pos == 'v'`) translated externally, send contextual `"to <word>"` queries
   (cached under `"v:<word>"` in scripts/cache/vi_gloss_cache.json) to prevent noun mistranslations.
4. Populate clean `relationMeanings` for 100% of `synonyms` and `antonyms`, fix repeated/off-context
   headwords, and rebuild `public/data/vocab/search-index.json`.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from nltk.corpus import wordnet as wn
from nltk.stem import SnowballStemmer

ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT / "public" / "data" / "vocab"
CACHE_DIR = ROOT / "scripts" / "cache"
CACHE_PATH = CACHE_DIR / "vi_gloss_cache.json"

STEMMER = SnowballStemmer("english")

VI_DIACRITIC_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.I,
)

DECK_PRIORITY = [
    "toeic-600",
    "toeic-ets",
    "topic-business",
    "toeic-idioms",
    "common-1000",
    "communication-daily",
    "oxford-3000-a1",
    "oxford-3000-a2",
    "oxford-3000-b1",
    "oxford-3000-b2",
    "oxford-5000-b2",
    "oxford-5000-c1",
    "ielts-core",
    "toefl-essential",
    "sat-core",
    "thpt-qg",
]

WN_POS_MAP = {
    "n": "n",
    "v": "v",
    "a": "adj",
    "s": "adj",
    "r": "adv",
}

# POS-aware curated TOEIC / Business English Vietnamese glosses (highest priority!)
CURATED_POS_GLOSSES: Dict[Tuple[str, str], str] = {
    ("train", "v"): "đào tạo, huấn luyện",
    ("train", "n"): "tàu hỏa, xe lửa",
    ("training", "n"): "sự đào tạo, huấn luyện",
    ("trainer", "n"): "huấn luyện viên, người đào tạo",
    ("trainee", "n"): "thực tập sinh, học viên",
    ("trainable", "adj"): "có thể đào tạo được",
    ("groom", "v"): "bồi dưỡng (nhân sự), chuẩn bị; chải chuốt",
    ("groom", "n"): "chú rể",
    ("deal", "v"): "giải quyết, xử lý; kinh doanh",
    ("deal", "n"): "thỏa thuận, giao dịch",
    ("book", "v"): "đặt trước (vé, phòng, chỗ)",
    ("book", "n"): "quyển sách; sổ sách",
    ("chair", "v"): "chủ trì (cuộc họp)",
    ("chair", "n"): "ghế; chủ tọa, chủ tịch",
    ("board", "v"): "lên (tàu, máy bay)",
    ("board", "n"): "hội đồng quản trị; bảng",
    ("charge", "v"): "tính phí; phụ trách; sạc pin",
    ("charge", "n"): "khoản phí, mức giá; trách nhiệm",
    ("file", "v"): "nộp (đơn, hồ sơ), lưu trữ",
    ("file", "n"): "hồ sơ, tệp tài liệu",
    ("order", "v"): "đặt hàng; ra lệnh",
    ("order", "n"): "đơn đặt hàng; trật tự",
    ("ship", "v"): "vận chuyển, giao hàng",
    ("ship", "n"): "con tàu, tàu thủy",
    ("plant", "v"): "trồng (cây)",
    ("plant", "n"): "nhà máy, phân xưởng; cây trồng",
    ("post", "v"): "đăng tải, gửi bưu điện",
    ("post", "n"): "chức vụ, vị trí; bưu điện",
    ("park", "v"): "đỗ xe, đậu xe",
    ("park", "n"): "công viên",
    ("sign", "v"): "ký tên, ký kết",
    ("sign", "n"): "biển báo, dấu hiệu",
    ("store", "v"): "lưu trữ, cất giữ",
    ("store", "n"): "cửa hàng",
    ("address", "v"): "giải quyết (vấn đề); phát biểu trước",
    ("address", "n"): "địa chỉ; bài phát biểu",
    ("fine", "v"): "phạt tiền",
    ("fine", "n"): "tiền phạt",
    ("fine", "adj"): "tốt đẹp, tinh xảo",
    ("firm", "n"): "công ty, hãng",
    ("firm", "adj"): "vững chắc, kiên quyết",
    ("check", "v"): "kiểm tra, rà soát",
    ("check", "n"): "tấm séc; hóa đơn; sự kiểm tra",
    ("bill", "v"): "lập hóa đơn, tính tiền",
    ("bill", "n"): "hóa đơn; dự luật",
    ("claim", "v"): "tuyên bố; yêu cầu bồi thường",
    ("claim", "n"): "yêu cầu bồi thường; tuyên bố",
    ("cover", "v"): "chi trả, bao gồm, che phủ",
    ("cover", "n"): "trang bìa; vỏ bọc",
    ("fund", "v"): "tài trợ, cấp vốn",
    ("fund", "n"): "quỹ, nguồn vốn",
    ("grant", "v"): "cấp cho, chấp thuận",
    ("grant", "n"): "khoản trợ cấp, tài trợ",
    ("lease", "v"): "cho thuê, thuê dài hạn",
    ("lease", "n"): "hợp đồng thuê",
    ("match", "v"): "khớp, tương xứng, phù hợp",
    ("match", "n"): "trận đấu; sự tương xứng",
    ("notice", "v"): "nhận thấy, chú ý",
    ("notice", "n"): "thông báo, bản báo trước",
    ("offer", "v"): "đề nghị, cung cấp",
    ("offer", "n"): "lời đề nghị, ưu đãi",
    ("present", "v"): "trình bày, thuyết trình; trao tặng",
    ("present", "n"): "món quà; hiện tại",
    ("present", "adj"): "có mặt, hiện tại",
    ("produce", "v"): "sản xuất, tạo ra",
    ("produce", "n"): "nông sản tươi",
    ("project", "v"): "dự báo, ước tính; trình chiếu",
    ("project", "n"): "dự án, kế hoạch",
    ("quote", "v"): "báo giá; trích dẫn",
    ("quote", "n"): "bảng báo giá; câu trích dẫn",
    ("rate", "v"): "đánh giá, xếp hạng",
    ("rate", "n"): "mức giá, tỷ lệ, cước phí",
    ("record", "v"): "ghi chép, ghi âm, ghi nhận",
    ("record", "n"): "hồ sơ, kỷ lục",
    ("refund", "v"): "hoàn tiền",
    ("refund", "n"): "khoản tiền hoàn lại",
    ("release", "v"): "phát hành, công bố",
    ("release", "n"): "sự phát hành, thông cáo",
    ("reserve", "v"): "đặt trước, dành riêng",
    ("reserve", "n"): "khoản dự trữ; khu bảo tồn",
    ("return", "v"): "trở lại, trả hàng, hoàn trả",
    ("return", "n"): "lợi nhuận thu về; sự trở lại",
    ("run", "v"): "vận hành, điều hành; chạy",
    ("run", "n"): "đợt chạy thử, quá trình vận hành",
    ("schedule", "v"): "lên lịch, sắp xếp lịch",
    ("schedule", "n"): "lịch trình, thời gian biểu",
    ("share", "v"): "chia sẻ, dùng chung",
    ("share", "n"): "cổ phần, thị phần",
    ("shift", "v"): "chuyển dịch, thay đổi",
    ("shift", "n"): "ca làm việc; sự chuyển dịch",
    ("staff", "v"): "bố trí nhân sự",
    ("staff", "n"): "đội ngũ nhân viên",
    ("stock", "v"): "dự trữ, nhập hàng vào kho",
    ("stock", "n"): "hàng tồn kho; cổ phiếu",
    ("supply", "v"): "cung cấp, cung ứng",
    ("supply", "n"): "nguồn cung, vật tư",
    ("track", "v"): "theo dõi, giám sát",
    ("track", "n"): "đường ray; dấu vết",
    ("transfer", "v"): "chuyển khoản, thuyên chuyển",
    ("transfer", "n"): "sự chuyển nhượng, chuyển khoản",
    ("yield", "v"): "mang lại (lợi nhuận, kết quả)",
    ("yield", "n"): "lợi suất, sản lượng",
    ("object", "v"): "phản đối",
    ("object", "n"): "đồ vật, đối tượng, mục tiêu",
    ("contract", "v"): "ký hợp đồng; thu hẹp, co lại",
    ("contract", "n"): "hợp đồng, giao kèo",
    ("conduct", "v"): "tiến hành, thực hiện",
    ("conduct", "n"): "hành vi, cách cư xử",
    ("permit", "v"): "cho phép",
    ("permit", "n"): "giấy phép",
    ("export", "v"): "xuất khẩu",
    ("export", "n"): "hàng xuất khẩu",
    ("import", "v"): "nhập khẩu",
    ("import", "n"): "hàng nhập khẩu",
    ("increase", "v"): "tăng lên, gia tăng",
    ("increase", "n"): "sự gia tăng, mức tăng",
    ("decrease", "v"): "giảm xuống, cắt giảm",
    ("decrease", "n"): "sự sụt giảm, mức giảm",
    ("progress", "v"): "tiến triển, phát triển",
    ("progress", "n"): "tiến độ, sự tiến bộ",
    ("protest", "v"): "phản đối, biểu tình",
    ("protest", "n"): "cuộc biểu tình, sự phản đối",
    ("survey", "v"): "khảo sát, xem xét",
    ("survey", "n"): "cuộc khảo sát, bản điều tra",
    ("update", "v"): "cập nhật",
    ("update", "n"): "bản cập nhật, thông tin mới nhất",
    ("upgrade", "v"): "nâng cấp",
    ("upgrade", "n"): "sự nâng cấp, phiên bản nâng cấp",
    ("discount", "v"): "giảm giá, chiết khấu",
    ("discount", "n"): "mức giảm giá, chiết khấu",
    ("suspect", "v"): "nghi ngờ",
    ("suspect", "n"): "nghi phạm",
    ("watch", "v"): "xem, theo dõi",
    ("watch", "n"): "đồng hồ đeo tay",
    ("lead", "v"): "dẫn dắt, dẫn đầu",
    ("lead", "n"): "vị trí dẫn đầu; khách hàng tiềm năng",
    ("launch", "v"): "ra mắt, tung ra (sản phẩm)",
    ("launch", "n"): "buổi ra mắt sản phẩm",
    ("draft", "v"): "soạn thảo bản nháp",
    ("draft", "n"): "bản thảo, bản nháp",
    ("handle", "v"): "xử lý, phụ trách",
    ("handle", "n"): "tay cầm",
    ("account", "v"): "giải thích, chiếm tỷ lệ",
    ("account", "n"): "tài khoản; bản báo cáo",
    ("balance", "v"): "cân bằng, quyết toán",
    ("balance", "n"): "số dư tài khoản; sự cân bằng",
    ("branch", "v"): "mở rộng nhánh",
    ("branch", "n"): "chi nhánh; nhánh",
    ("deposit", "v"): "đặt cọc, gửi tiền",
    ("deposit", "n"): "tiền đặt cọc, tiền gửi",
    ("note", "v"): "lưu ý, ghi chép",
    ("note", "n"): "ghi chú, tờ tiền giấy",
    ("pay", "v"): "thanh toán, trả tiền",
    ("pay", "n"): "tiền lương, thù lao",
    ("raise", "v"): "nâng lên, huy động (vốn)",
    ("raise", "n"): "sự tăng lương",
    ("review", "v"): "xem xét, đánh giá lại",
    ("review", "n"): "bài đánh giá, sự xem xét lại",
    ("award", "v"): "trao giải, trao thưởng",
    ("award", "n"): "giải thưởng",
    ("access", "v"): "truy cập, tiếp cận",
    ("access", "n"): "quyền truy cập, lối vào",
    ("appeal", "v"): "kháng cáo; thu hút, kêu gọi",
    ("appeal", "n"): "sự hấp dẫn; đơn kháng cáo",
    ("benefit", "v"): "hưởng lợi, mang lại lợi ích",
    ("benefit", "n"): "lợi ích, phúc lợi",
    ("budget", "v"): "lập ngân sách",
    ("budget", "n"): "ngân sách",
    ("coach", "v"): "huấn luyện, hướng dẫn",
    ("coach", "n"): "huấn luyện viên; xe khách",
    ("cost", "v"): "tiêu tốn, có giá là",
    ("cost", "n"): "chi phí, giá thành",
    ("display", "v"): "trưng bày, hiển thị",
    ("display", "n"): "màn hình; gian trưng bày",
    ("estimate", "v"): "ước tính, dự toán",
    ("estimate", "n"): "bản ước tính, dự toán",
    ("exchange", "v"): "trao đổi, đổi trả",
    ("exchange", "n"): "sự trao đổi; tỷ giá hối đoái",
    ("experience", "v"): "trải nghiệm, gặp phải",
    ("experience", "n"): "kinh nghiệm, trải nghiệm",
    ("focus", "v"): "tập trung vào",
    ("focus", "n"): "trọng tâm, tiêu điểm",
    ("guarantee", "v"): "bảo đảm, cam đoan",
    ("guarantee", "n"): "sự bảo hành, bảo đảm",
    ("head", "v"): "đứng đầu, dẫn dắt",
    ("head", "n"): "người đứng đầu, trưởng bộ phận",
    ("host", "v"): "đăng cai tổ chức, dẫn chương trình",
    ("host", "n"): "chủ nhà, đơn vị đăng cai",
    ("impact", "v"): "tác động, ảnh hưởng đến",
    ("impact", "n"): "tác động, ảnh hưởng",
    ("issue", "v"): "phát hành, cấp phát",
    ("issue", "n"): "vấn đề; ấn bản, số phát hành",
    ("link", "v"): "liên kết, kết nối",
    ("link", "n"): "đường dẫn, mối liên kết",
    ("list", "v"): "liệt kê, niêm yết",
    ("list", "n"): "danh sách",
    ("load", "v"): "chất hàng, tải lên",
    ("load", "n"): "tải trọng, khối lượng hàng",
    ("loan", "v"): "cho vay",
    ("loan", "n"): "khoản vay",
    ("log", "v"): "ghi nhật ký, đăng nhập",
    ("log", "n"): "nhật ký hệ thống",
    ("market", "v"): "tiếp thị, quảng bá",
    ("market", "n"): "thị trường, chợ",
    ("measure", "v"): "đo lường, đánh giá",
    ("measure", "n"): "biện pháp; đơn vị đo",
    ("monitor", "v"): "giám sát, theo dõi",
    ("monitor", "n"): "màn hình máy tính; người giám sát",
    ("pack", "v"): "đóng gói",
    ("pack", "n"): "gói hàng, bộ sản phẩm",
    ("partner", "v"): "hợp tác, liên kết",
    ("partner", "n"): "đối tác",
    ("plan", "v"): "lập kế hoạch, dự định",
    ("plan", "n"): "kế hoạch, phương án",
    ("pledge", "v"): "cam kết, hứa hẹn",
    ("pledge", "n"): "lời cam kết",
    ("price", "v"): "định giá",
    ("price", "n"): "giá cả, mức giá",
    ("profit", "v"): "thu lợi nhuận, hưởng lợi",
    ("profit", "n"): "lợi nhuận",
    ("promise", "v"): "hứa hẹn, cam kết",
    ("promise", "n"): "lời hứa, sự cam kết",
    ("purchase", "v"): "mua sắm, thu mua",
    ("purchase", "n"): "giao dịch mua hàng, món hàng mua",
    ("question", "v"): "đặt câu hỏi, nghi vấn",
    ("question", "n"): "câu hỏi, vấn đề",
    ("range", "v"): "dao động trong khoảng",
    ("range", "n"): "phạm vi, dòng sản phẩm",
    ("rank", "v"): "xếp hạng",
    ("rank", "n"): "thứ hạng, cấp bậc",
    ("rent", "v"): "thuê, cho thuê",
    ("rent", "n"): "tiền thuê nhà/mặt bằng",
    ("repair", "v"): "sửa chữa, khắc phục",
    ("repair", "n"): "việc sửa chữa",
    ("report", "v"): "báo cáo, trình báo",
    ("report", "n"): "bản báo cáo",
    ("request", "v"): "yêu cầu, đề nghị",
    ("request", "n"): "lời yêu cầu, đơn đề nghị",
    ("research", "v"): "nghiên cứu, tìm hiểu",
    ("research", "n"): "công trình nghiên cứu",
    ("reward", "v"): "thưởng, đền đáp",
    ("reward", "n"): "phần thưởng",
    ("risk", "v"): "mạo hiểm, liều lĩnh",
    ("risk", "n"): "rủi ro",
    ("sample", "v"): "dùng thử, lấy mẫu",
    ("sample", "n"): "mẫu thử, hàng mẫu",
    ("scale", "v"): "mở rộng quy mô",
    ("scale", "n"): "quy mô; cái cân",
    ("score", "v"): "ghi điểm, đạt điểm",
    ("score", "n"): "điểm số",
    ("screen", "v"): "sàng lọc (ứng viên); trình chiếu",
    ("screen", "n"): "màn hình",
    ("search", "v"): "tìm kiếm",
    ("search", "n"): "cuộc tìm kiếm",
    ("service", "v"): "bảo dưỡng, bảo trì",
    ("service", "n"): "dịch vụ",
    ("sponsor", "v"): "tài trợ",
    ("sponsor", "n"): "nhà tài trợ",
    ("support", "v"): "hỗ trợ, ủng hộ",
    ("support", "n"): "sự hỗ trợ",
    ("target", "v"): "nhắm mục tiêu vào",
    ("target", "n"): "mục tiêu, chỉ tiêu",
    ("tax", "v"): "đánh thuế",
    ("tax", "n"): "thuế",
    ("test", "v"): "kiểm tra, thử nghiệm",
    ("test", "n"): "bài kiểm tra, cuộc thử nghiệm",
    ("tour", "v"): "đi tham quan, lưu diễn",
    ("tour", "n"): "chuyến tham quan",
    ("trade", "v"): "giao dịch, buôn bán",
    ("trade", "n"): "thương mại, giao dịch",
    ("trust", "v"): "tin tưởng",
    ("trust", "n"): "sự tin tưởng; quỹ tín thác",
    ("value", "v"): "định giá; coi trọng",
    ("value", "n"): "giá trị",
    ("visit", "v"): "ghé thăm, tham quan",
    ("visit", "n"): "chuyến thăm",
    ("vote", "v"): "bỏ phiếu, bình chọn",
    ("vote", "n"): "lá phiếu, cuộc bỏ phiếu",
    ("work", "v"): "làm việc, vận hành",
    ("work", "n"): "công việc, tác phẩm",
}

# General word-level curated TOEIC glosses (used when POS-specific key not present)
CURATED_TOEIC_GLOSSES: Dict[str, str] = {
    "agreement": "hợp đồng, thỏa thuận",
    "contract": "hợp đồng, giao kèo",
    "accord": "hiệp định, sự đồng thuận",
    "deal": "thỏa thuận, giao dịch; giải quyết",
    "settlement": "sự thỏa thuận, giải quyết; thanh toán",
    "concurrence": "sự đồng thuận, nhất trí",
    "dispute": "tranh chấp, bất đồng",
    "disagreement": "sự bất đồng, bất hòa",
    "comply with": "tuân thủ theo",
    "adhere to": "tuân theo, bám sát",
    "obey": "tuân lệnh, tuân thủ",
    "violate": "vi phạm",
    "breach": "vi phạm (hợp đồng, quy định)",
    "assurance": "sự cam đoan, bảo đảm",
    "guarantee": "sự bảo hành, bảo đảm",
    "pledge": "lời cam kết, hứa hẹn",
    "promise": "lời hứa, cam kết",
    "doubt": "sự nghi ngờ",
    "uncertainty": "sự không chắc chắn",
    "cancellation": "sự hủy bỏ",
    "termination": "sự chấm dứt (hợp đồng)",
    "revocation": "sự thu hồi, hủy bỏ",
    "confirmation": "sự xác nhận",
    "booking": "việc đặt chỗ, đặt trước",
    "interest": "lãi suất; lợi ích; sự quan tâm",
    "minutes": "biên bản cuộc họp",
    "customs": "hải quan",
    "due": "đến hạn (thanh toán, nộp bài)",
    "engage": "thu hút, tham gia; thuê mướn",
    "execute": "thực thi, triển khai (kế hoạch/hợp đồng)",
    "facility": "cơ sở vật chất, nhà máy, tiện nghi",
    "figure": "con số, số liệu; nhân vật",
    "forward": "chuyển tiếp; hướng về phía trước",
    "leave": "kỳ nghỉ phép; rời đi",
    "line": "dòng sản phẩm; đường dây; hàng ngũ",
    "margin": "biên lợi nhuận; lề",
    "means": "phương tiện, nguồn lực tài chính",
    "meet": "đáp ứng (yêu cầu, hạn chót); gặp gỡ",
    "outlet": "cửa hàng đại lý; ổ cắm điện",
    "overhead": "chi phí vận hành cố định",
    "party": "bên (tham gia hợp đồng); bữa tiệc",
    "pitch": "bài chào hàng, thuyết trình gọi vốn",
    "premium": "phí bảo hiểm; cao cấp, thượng hạng",
    "proceeds": "tiền thu được (từ bán hàng/sự kiện)",
    "provision": "điều khoản; sự cung cấp",
    "quarter": "quý (3 tháng tài chính); một phần tư",
    "receipt": "biên lai, hóa đơn; sự tiếp nhận",
    "refer": "giới thiệu, tham khảo, đề cập đến",
    "remit": "chuyển tiền thanh toán",
    "resolve": "giải quyết dứt điểm; nghị quyết",
    "retain": "giữ chân (nhân sự/khách hàng), duy trì",
    "revenue": "doanh thu",
    "secure": "đạt được, bảo đảm; an toàn",
    "settle": "giải quyết, thanh toán, dàn xếp",
    "shortage": "sự thiếu hụt",
    "stake": "cổ phần, quyền lợi liên quan",
    "statement": "bản sao kê, bản tuyên bố",
    "submit": "nộp, đệ trình",
    "surplus": "thặng dư, lượng dư thừa",
    "suspend": "tạm đình chỉ, tạm hoãn",
    "tender": "hồ sơ dự thầu; đề xuất chính thức",
    "turnover": "doanh số; tỷ lệ luân chuyển nhân sự",
    "utility": "dịch vụ tiện ích (điện, nước, gas)",
    "venture": "dự án liên doanh, dự án mạo hiểm",
    "venue": "địa điểm tổ chức sự kiện",
    "voucher": "phiếu giảm giá, chứng từ thanh toán",
    "waive": "miễn trừ (phí, điều kiện)",
    "warranty": "giấy bảo hành, chế độ bảo hành",
    "wholesale": "bán buôn, bán sỉ",
    "withdraw": "rút tiền; rút lui, thu hồi",
}

OFF_CONTEXT_MEANINGS = {"chia bài", "chia bai"}

# Known irregular morphological root families (so valid irregular forms like sell/sale, choose/choice pass!)
IRREGULAR_ROOT_GROUPS: List[Set[str]] = [
    {"sell", "sale", "sales", "resell", "resale"},
    {"choose", "choice", "choosy"},
    {"lose", "loss", "loser"},
    {"speak", "speech", "speaker", "spoken"},
    {"think", "thought", "thoughtful", "thinker"},
    {"know", "knowledge", "knowledgeable"},
    {"grow", "growth", "outgrow"},
    {"wide", "width", "widen"},
    {"long", "length", "lengthen", "lengthy"},
    {"strong", "strength", "strengthen"},
    {"high", "height", "heighten"},
    {"deep", "depth", "deepen"},
    {"broad", "breadth", "broaden"},
    {"true", "truth", "truthful", "truly"},
    {"prove", "proof", "disprove", "approve", "approval", "improve", "improvement"},
    {"advise", "advice", "advisor", "adviser", "advisory"},
    {"devise", "device"},
    {"receive", "reception", "receipt", "recipient", "receptive"},
    {"perceive", "perception", "perceptive"},
    {"conceive", "conception", "concept", "conceptual"},
    {"deceive", "deception", "deceptive"},
    {"maintain", "maintenance"},
    {"retain", "retention", "retainer"},
    {"sustain", "sustainable", "sustainability", "sustenance"},
    {"abstain", "abstention"},
    {"detain", "detention"},
    {"explain", "explanation", "explanatory"},
    {"acquire", "acquisition"},
    {"require", "requirement", "requisite"},
    {"inquire", "inquiry", "enquiry"},
    {"consume", "consumption", "consumer"},
    {"assume", "assumption"},
    {"presume", "presumption"},
    {"resume", "resumption"},
    {"subscribe", "subscription", "subscriber"},
    {"describe", "description", "descriptive"},
    {"prescribe", "prescription"},
    {"solve", "solution", "solvent", "insolvent"},
    {"resolve", "resolution", "resolute"},
    {"evolve", "evolution", "evolutionary"},
    {"involve", "involvement"},
    {"proceed", "procedure", "procedural", "proceeds"},
    {"succeed", "success", "successful", "successor", "succession"},
    {"exceed", "excess", "excessive"},
    {"concede", "concession"},
    {"permit", "permission", "permissible"},
    {"submit", "submission", "submissive"},
    {"admit", "admission", "admittance"},
    {"commit", "commitment", "commission"},
    {"omit", "omission"},
    {"transmit", "transmission"},
    {"extend", "extension", "extensive"},
    {"expand", "expansion", "expansive"},
    {"suspend", "suspension"},
    {"respond", "response", "responsive", "responsible", "responsibility"},
    {"correspond", "correspondence", "correspondent"},
    {"defend", "defense", "defence", "defensive", "defendant"},
    {"offend", "offense", "offence", "offensive"},
    {"attend", "attention", "attentive", "attendance", "attendant", "attendee"},
    {"intend", "intention", "intentional"},
    {"fly", "flight"},
    {"die", "death", "dead", "deadly"},
    {"live", "life", "lively", "alive"},
    {"see", "sight", "visible", "vision"},
    {"hear", "hearing"},
    {"give", "gift"},
    {"weigh", "weight"},
    {"strike", "stroke"},
    {"bind", "bound", "bond"},
    {"buy", "buyer"},
    {"pay", "payment", "payable", "payee", "payer", "payroll"},
    {"say", "saying"},
    {"lay", "layout"},
    {"lead", "leader", "leadership"},
    {"feed", "feedback"},
    {"clear", "clarity", "clarify", "clarification", "clearance"},
    {"able", "ability", "enable", "disable", "unable", "capability", "capable"},
    {"simple", "simplify", "simplification", "simplicity"},
    {"vary", "variety", "various", "variable", "variation"},
    {"apply", "application", "applicant", "applicable"},
    {"comply", "compliance", "compliant"},
    {"rely", "reliable", "reliability", "reliance"},
    {"supply", "supplier"},
    {"deny", "denial"},
    {"try", "trial"},
    {"decide", "decision", "decisive", "indecisive"},
    {"divide", "division", "divisive"},
    {"provide", "provision", "provider"},
    {"revise", "revision"},
    {"supervise", "supervision", "supervisor", "supervisory"},
    {"conclude", "conclusion", "conclusive"},
    {"include", "inclusion", "inclusive"},
    {"exclude", "exclusion", "exclusive"},
    {"produce", "production", "product", "productive", "productivity", "producer"},
    {"reduce", "reduction"},
    {"introduce", "introduction", "introductory"},
    {"brief", "brevity"},
    {"anxious", "anxiety"},
    {"social", "society", "socialize"},
    {"grateful", "gratitude"},
    {"example", "exemplify", "exemplary"},
    {"peace", "pacify", "peaceful"},
]

IRREGULAR_ROOT_MAP: Dict[str, int] = {}
for _gid, _grp in enumerate(IRREGULAR_ROOT_GROUPS):
    for _tok in _grp:
        IRREGULAR_ROOT_MAP[_tok] = _gid

COMMON_PREFIXES = (
    "under", "over", "inter", "trans", "super", "micro", "macro", "multi", "counter",
    "non", "dis", "mis", "pre", "sub", "out", "pro", "un", "in", "im", "il", "ir", "re", "co", "de", "ex",
)

DERIVATIONAL_SUFFIXES = (
    "ation", "ition", "tion", "sion", "ment", "ness", "ity", "ship", "hood", "ance", "ence",
    "able", "ible", "ative", "itive", "ical", "ious", "eous", "less", "fully", "ingly", "edly",
    "ize", "ise", "ify", "ate", "ant", "ent", "ist", "ism", "ful", "ous", "ive", "ial", "ary",
    "ory", "ery", "ure", "age", "ing", "ed", "er", "or", "ee", "al", "ic", "ly", "ty", "ry", "th", "en",
)

VALID_ASCII_VI = {
    "phim", "logic", "chung", "trang web", "chia", "vay", "suy ra", "kho", "pin", "ngon",
    "thang", "cabin", "taxi", "video", "radio", "menu", "email", "internet", "online",
    "marketing", "studio", "album", "camera", "sofa", "salad", "pizza", "robot", "radar",
    "laser", "metro", "virus", "vitamin", "piano", "guitar", "cafe", "golf", "tennis",
    "karaoke", "yoga", "spa", "bar", "club", "blog", "app", "web", "wifi", "sim", "usb",
    "xe", "nha", "ban", "cho", "mua", "xem", "nghe", "noi", "lam", "di", "ra", "vao",
    "len", "con", "co", "hay", "nho", "cao", "nhanh", "moi", "tot", "sai", "quen",
    "an", "hoc", "doc", "hat", "vui", "lo", "tin", "can", "nen", "do", "vi", "theo",
    "voi", "trong", "ngoai", "tren", "sau", "ben", "gan", "xa", "nay", "sao", "khi",
    "ngay", "sang", "trua", "toi", "nam", "mua", "xuan", "ha", "thu", "may", "nang",
    "song", "cay", "hoa", "la", "qua", "hat", "nguoi", "phong", "tu", "den", "tau",
    "cong", "hang", "quan", "the", "gia", "phi", "von", "lai", "so", "don",
    "sach", "bao", "anh", "nhac", "thi", "muc", "phan", "bo", "doi", "nganh", "viec",
    "luat", "le", "quy", "ke", "du", "he", "mang", "bai", "cau", "chu", "cach", "ky",
    "khoa", "y", "giao", "kinh", "tai", "van", "an", "quoc", "cung", "chi", "tra",
    "xin", "thu", "goi", "gui", "nhan", "mo", "dong", "bat", "tat", "tang", "giam",
    "doi", "sua", "xoa", "them", "chon", "loc", "tim", "xep", "chay", "bay", "boi",
    "in", "luu", "phat", "dung", "tiep", "lui", "quay", "xoay", "keo", "day",
    "nang", "ha", "cat", "dan", "gop", "tach", "nhan", "tru", "tinh",
}

ENGLISH_STOPWORDS = {
    "the", "of", "to", "a", "an", "in", "on", "for", "with", "that", "which", "who",
    "someone", "something", "relating", "having", "capable", "being", "act", "quality",
    "state", "person", "place", "process", "make", "become", "cause", "without", "not",
    "or", "and", "from", "into", "by", "as", "is", "are", "be", "used", "using",
}


def normalize_key(word: str) -> str:
    return re.sub(r"\s+", " ", (word or "").strip().lower())


def normalize_pos(pos: str) -> str:
    p = (pos or "n").strip().lower()
    if p in ("n", "noun"):
        return "n"
    if p in ("v", "verb"):
        return "v"
    if p in ("adj", "a", "s", "adjective"):
        return "adj"
    if p in ("adv", "r", "adverb"):
        return "adv"
    if "phr" in p:
        return "phrase"
    return p or "n"


def _strip_prefix_variants(word: str) -> List[str]:
    variants = [word]
    for pref in COMMON_PREFIXES:
        if word.startswith(pref) and len(word) - len(pref) >= 4:
            variants.append(word[len(pref):])
    return variants


def _common_prefix_len(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def shares_morphological_root(headword: str, candidate: str) -> bool:
    """
    Strict morphological same-root validator for Word Family entries.
    Eliminates 100% of cross-root synset leaks (e.g., `groom` / `prepare` inside `training`).
    """
    hw_tokens = re.findall(r"[a-z]+", normalize_key(headword))
    cand_tokens = re.findall(r"[a-z]+", normalize_key(candidate))
    if not hw_tokens or not cand_tokens:
        return False

    # Use primary lexical token for phrasal verbs/expressions (e.g. "abide by" -> "abide")
    hw = hw_tokens[0]
    cand = cand_tokens[0]
    if hw == cand:
        return False
    if len(cand) < 3 or len(hw) < 2:
        return False

    # 1. Explicit irregular morphological root groups
    g1 = IRREGULAR_ROOT_MAP.get(hw)
    g2 = IRREGULAR_ROOT_MAP.get(cand)
    if g1 is not None and g1 == g2:
        return True

    # 2. Stem & prefix comparison across base & unprefixed variants
    hw_vars = _strip_prefix_variants(hw)
    cand_vars = _strip_prefix_variants(cand)

    for a in hw_vars:
        sa = STEMMER.stem(a)
        for b in cand_vars:
            sb = STEMMER.stem(b)
            # Exact Snowball stem match (e.g. training -> train, train -> train)
            if sa == sb and len(sa) >= 3:
                return True

            # One stem is a direct prefix of the other (e.g. train -> trainer / trainee)
            shorter_s, longer_s = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
            if len(shorter_s) >= 4 and longer_s.startswith(shorter_s):
                return True
            if len(shorter_s) == 3 and longer_s.startswith(shorter_s):
                # Allow 3-letter roots only when the longer word carries a clear derivational suffix
                longer_word = b if len(sa) <= len(sb) else a
                if any(longer_word.endswith(suf) for suf in DERIVATIONAL_SUFFIXES):
                    return True

            # Common prefix check on raw stems/words (handles e.g. decide/decision, agree/agreeable)
            cp_raw = _common_prefix_len(a, b)
            min_len = min(len(a), len(b))
            if cp_raw >= 4 and (cp_raw / max(1, min_len)) >= 0.55:
                return True
            if cp_raw >= 5:
                return True

    return False


def get_exact_lemma_wordnet_family(headword: str) -> List[Tuple[str, str]]:
    """
    Query NLTK WordNet derivationally_related_forms() STRICTLY on lemmas matching `headword`
    (never on unrelated synonymous lemmas in the same synset!), plus 1-hop exact-lemma
    derivation from direct same-root base lemmas (e.g. training -> train -> trainer/trainee).
    Every returned candidate MUST pass `shares_morphological_root(headword, cand)`.
    """
    hw = normalize_key(headword)
    if " " in hw or not hw.isalpha():
        return []

    found: Dict[Tuple[str, str], None] = {}
    hop1_lemmas: Set[str] = set()

    def collect_for_exact_lemma(target: str, record_hop1: bool = False):
        for syn in wn.synsets(target):
            for lem in syn.lemmas():
                # STRICT: only call derivationally_related_forms on exact matching lemma!
                if lem.name().lower() != target:
                    continue
                for deriv in lem.derivationally_related_forms():
                    dname = deriv.name().lower().replace("_", " ")
                    if " " in dname or not dname.isalpha() or dname == hw:
                        continue
                    dpos = WN_POS_MAP.get(deriv.synset().pos(), "n")
                    if shares_morphological_root(hw, dname):
                        found[(dname, dpos)] = None
                        if record_hop1:
                            hop1_lemmas.add(dname)

    collect_for_exact_lemma(hw, record_hop1=True)

    # 1-hop expansion on same-root base verbs/nouns (e.g. training -> train -> trainer, trainee)
    for base in sorted(hop1_lemmas):
        if len(base) <= len(hw):
            collect_for_exact_lemma(base, record_hop1=False)

    return list(found.keys())


def is_english_definition_or_repeat(meaning: str, word: str) -> bool:
    m = (meaning or "").strip()
    w = normalize_key(word)
    if not m:
        return True
    ml = normalize_key(m)
    if ml in OFF_CONTEXT_MEANINGS:
        return True
    clean_ml = re.sub(r"[^a-z0-9\s-]", "", ml).strip()
    clean_w = re.sub(r"[^a-z0-9\s-]", "", w).strip()
    if clean_ml == clean_w and clean_ml not in VALID_ASCII_VI:
        return True
    m_no_pos = re.sub(r"^\[[^\]]+\]\s*", "", m).strip()
    if normalize_key(m_no_pos) == w and normalize_key(m_no_pos) not in VALID_ASCII_VI:
        return True

    if VI_DIACRITIC_RE.search(m):
        return False

    tokens = re.findall(r"[a-z]+", ml)
    if not tokens:
        return True
    if ml in VALID_ASCII_VI:
        return False
    if any(t in ENGLISH_STOPWORDS for t in tokens):
        return True
    if len(tokens) == 1 and tokens[0] not in VALID_ASCII_VI:
        return True
    vi_token_hits = sum(1 for t in tokens if t in VALID_ASCII_VI)
    if vi_token_hits < max(1, len(tokens) * 0.6):
        return True
    return False


def clean_gloss_text(text: str, is_verb: bool = False) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    t = t.strip(" \"'“”‘’.")
    prefixes = [
        "khái niệm về ",
        "khái niệm ",
        "nghĩa của ",
        "ý nghĩa của ",
        "từ ",
        "một ",
        "rất ",
        "hành động ",
    ]
    if is_verb:
        prefixes = ["để ", "tới ", "việc "] + prefixes
    for prefix in prefixes:
        if t.lower().startswith(prefix) and len(t) > len(prefix) + 2:
            t = t[len(prefix):].strip()
    if len(t) >= 2 and t[0].isupper() and t[1].islower():
        t = t[0].lower() + t[1:]
    return t


def load_cache() -> Dict[str, str]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: Dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _gtx_translate_text(text: str) -> str:
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t"
    body = urllib.parse.urlencode({"q": text}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return "".join(seg[0] for seg in payload[0] if seg and seg[0])


def _parse_numbered_lines(translated: str, items: List[str], is_verb: bool = False) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for ln in translated.splitlines():
        m = re.match(r"^\s*(\d+)\s*[\.\):\-]\s*(.+?)\s*$", ln)
        if not m:
            continue
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(items):
            out[items[idx]] = clean_gloss_text(m.group(2), is_verb=is_verb)
    if len(out) < len(items) * 0.8:
        lines = [ln.strip() for ln in translated.splitlines() if ln.strip()]
        if len(lines) == len(items):
            for orig, tr in zip(items, lines):
                tr_clean = re.sub(r"^\s*\d+\s*[\.\):\-]\s*", "", tr)
                out[orig] = clean_gloss_text(tr_clean, is_verb=is_verb)
    return out


def translate_chunk(items: List[str], mode: str = "plain") -> Dict[str, str]:
    """
    mode:
      - 'plain': numbered "<word>"
      - 'verb': numbered "to <word>" (guarantees verb sense instead of noun sense!)
      - 'context': numbered "the concept of <word>"
    """
    out: Dict[str, str] = {}
    if not items:
        return out

    if mode == "verb":
        payload = "\n".join(f"{i + 1}. to {w}" for i, w in enumerate(items))
    elif mode == "context":
        payload = "\n".join(f"{i + 1}. the concept of {w}" for i, w in enumerate(items))
    else:
        payload = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(items))

    is_verb = mode == "verb"
    for attempt in range(4):
        try:
            res = _gtx_translate_text(payload)
            parsed = _parse_numbered_lines(res, items, is_verb=is_verb)
            if parsed:
                for k, v in parsed.items():
                    v2 = re.sub(
                        r"\s+(một cái gì đó|cái gì đó|điều gì đó|thứ gì đó)$",
                        "",
                        v,
                        flags=re.I,
                    ).strip()
                    if mode == "plain" or not is_english_definition_or_repeat(v2, k):
                        out[k] = v2
                time.sleep(0.18)
                return out
        except Exception:
            time.sleep(1.2 * (attempt + 1))

    try:
        from deep_translator import GoogleTranslator

        tr = GoogleTranslator(source="en", target="vi")
        res = tr.translate(payload)
        if res:
            parsed = _parse_numbered_lines(res, items, is_verb=is_verb)
            for k, v in parsed.items():
                if mode == "plain" or not is_english_definition_or_repeat(v, k):
                    out[k] = v
    except Exception:
        pass
    return out


def main():
    print("[1/5] Loading all 16 vocab decks & building POS-aware internal dictionary...")
    deck_files = sorted(
        p for p in VOCAB_DIR.glob("*.json") if p.name not in ("index.json", "search-index.json")
    )
    decks: Dict[str, Tuple[Path, dict]] = {}
    for p in deck_files:
        decks[p.stem] = (p, json.loads(p.read_text(encoding="utf-8")))

    # Build POS-aware Priority-1 internal Vietnamese dictionaries
    internal_gloss_by_pos: Dict[Tuple[str, str], str] = dict(CURATED_POS_GLOSSES)
    internal_gloss_any: Dict[str, str] = dict(CURATED_TOEIC_GLOSSES)
    bank_words_set: Set[str] = set()

    ordered_deck_ids = [d for d in DECK_PRIORITY if d in decks] + [
        d for d in decks if d not in DECK_PRIORITY
    ]
    for dk in ordered_deck_ids:
        _, data = decks[dk]
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                key = normalize_key(w.get("word", ""))
                pos = normalize_pos(w.get("pos", "n"))
                if not key:
                    continue
                bank_words_set.add(key)
                meaning = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                # Skip corrupted headword meanings (e.g. oxford-3000-a2 train(v) == "tàu")
                if (key, pos) in CURATED_POS_GLOSSES:
                    continue
                if not is_english_definition_or_repeat(meaning, key):
                    if (key, pos) not in internal_gloss_by_pos:
                        internal_gloss_by_pos[(key, pos)] = meaning
                    if key not in internal_gloss_any:
                        internal_gloss_any[key] = meaning

    print(
        f"    POS-specific internal glosses: {len(internal_gloss_by_pos)} | "
        f"General internal glosses: {len(internal_gloss_any)}"
    )

    cache = load_cache()
    for (ck, cpos), cv in CURATED_POS_GLOSSES.items():
        cache[f"{cpos}:{ck}"] = cv
    for ck, cv in CURATED_TOEIC_GLOSSES.items():
        cache[ck] = cv

    # Step 2: Audit & rebuild clean same-root Word Families + collect any missing verb/plain translations
    print("[2/5] Filtering cross-root Word Family leaks & collecting POS-aware translation queue...")
    stats = {
        "wf_removed_wrong_root": 0,
        "wf_added_exact_wn": 0,
        "wf_pos_meaning_fixed": 0,
        "headwords_pos_fixed": 0,
        "rel_pos_meaning_fixed": 0,
    }

    plain_needed: Set[str] = set()
    verb_needed: Set[str] = set()
    rebuilt_wf_cache: Dict[str, List[Tuple[str, str]]] = {}

    for dk, (_, data) in decks.items():
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                hw = w["word"]
                hw_key = normalize_key(hw)
                hw_pos = normalize_pos(w.get("pos", "n"))

                # Step 2a: Filter existing wordFamily strictly by same morphological root
                kept_pairs: List[Tuple[str, str]] = []
                seen_wf_words: Set[str] = set()
                for wf in w.get("wordFamily", []):
                    wf_word = (wf.get("word") or "").strip()
                    wf_key = normalize_key(wf_word)
                    wf_pos = normalize_pos(wf.get("pos", "n"))
                    if not wf_key or wf_key == hw_key or wf_key in seen_wf_words:
                        continue
                    if shares_morphological_root(hw, wf_word):
                        kept_pairs.append((wf_word, wf_pos))
                        seen_wf_words.add(wf_key)
                    else:
                        stats["wf_removed_wrong_root"] += 1

                # Step 2b: Enrich with exact-lemma NLTK WordNet same-root derivatives (up to 4 total)
                if len(kept_pairs) < 4 and " " not in hw_key and hw_key.isalpha():
                    wn_cands = get_exact_lemma_wordnet_family(hw_key)
                    # Prioritize forms present in our 10,996-word TOEIC/Oxford bank or curated glosses
                    wn_cands.sort(
                        key=lambda pair: (
                            0 if (pair[0], pair[1]) in CURATED_POS_GLOSSES else 1,
                            0 if pair[0] in bank_words_set else 1,
                            len(pair[0]),
                            pair[0],
                        )
                    )
                    for cand_w, cand_pos in wn_cands:
                        if len(kept_pairs) >= 4:
                            break
                        if cand_w in seen_wf_words or cand_w == hw_key:
                            continue
                        kept_pairs.append((cand_w, cand_pos))
                        seen_wf_words.add(cand_w)
                        stats["wf_added_exact_wn"] += 1

                rebuilt_wf_cache[w["id"]] = kept_pairs

                # Check if any verb/plain term needs fresh POS-aware translation
                for wf_w, wf_pos in kept_pairs:
                    wk = normalize_key(wf_w)
                    if (wk, wf_pos) in internal_gloss_by_pos:
                        continue
                    if wf_pos == "v":
                        vkey = f"v:{wk}"
                        if vkey not in cache or is_english_definition_or_repeat(cache[vkey], wk):
                            verb_needed.add(wk)
                    else:
                        if wk not in internal_gloss_any and (
                            wk not in cache or is_english_definition_or_repeat(cache[wk], wk)
                        ):
                            plain_needed.add(wk)

                for rel in list(w.get("synonyms", [])) + list(w.get("antonyms", [])):
                    rk = normalize_key(rel)
                    if not rk:
                        continue
                    if (rk, hw_pos) in internal_gloss_by_pos:
                        continue
                    if hw_pos == "v" and (rk, "n") in internal_gloss_by_pos and (rk, "v") not in internal_gloss_by_pos:
                        vkey = f"v:{rk}"
                        if vkey not in cache or is_english_definition_or_repeat(cache[vkey], rk):
                            verb_needed.add(rk)
                    elif rk not in internal_gloss_any and (
                        rk not in cache or is_english_definition_or_repeat(cache[rk], rk)
                    ):
                        plain_needed.add(rk)

    print(
        f"    Cross-root Word Family items filtered out: {stats['wf_removed_wrong_root']} | "
        f"Same-root WordNet additions: {stats['wf_added_exact_wn']}"
    )
    print(
        f"[3/5] Contextual verb lookups needed ('to <word>'): {len(verb_needed)} | "
        f"Plain lookups needed: {len(plain_needed)}"
    )

    # Translate verbs using contextual "to <word>" so they NEVER fall back to noun meanings!
    if verb_needed:
        vlist = sorted(verb_needed)
        vbatches = [vlist[i : i + 80] for i in range(0, len(vlist), 80)]
        done = 0
        with ThreadPoolExecutor(max_workers=2) as ex:
            futs = {ex.submit(translate_chunk, b, "verb"): b for b in vbatches}
            for fut in as_completed(futs):
                res = fut.result()
                for k, v in res.items():
                    cache[f"v:{k}"] = v
                done += 1
                if done % 10 == 0 or done == len(vbatches):
                    print(f"    Verb pass translated {done}/{len(vbatches)} batches...")
                    save_cache(cache)

    if plain_needed:
        plist = sorted(plain_needed)
        pbatches = [plist[i : i + 100] for i in range(0, len(plist), 100)]
        done = 0
        with ThreadPoolExecutor(max_workers=2) as ex:
            futs = {ex.submit(translate_chunk, b, "plain"): b for b in pbatches}
            for fut in as_completed(futs):
                res = fut.result()
                cache.update(res)
                done += 1
                if done % 10 == 0 or done == len(pbatches):
                    print(f"    Plain pass translated {done}/{len(pbatches)} batches...")
                    save_cache(cache)

    save_cache(cache)

    def resolve_pos_meaning(term: str, pos: Optional[str] = None) -> Optional[str]:
        k = normalize_key(term)
        p = normalize_pos(pos) if pos else ""
        if not k:
            return None

        # Priority 1: Exact (word, pos) in curated TOEIC overrides
        if p and (k, p) in CURATED_POS_GLOSSES:
            return CURATED_POS_GLOSSES[(k, p)]

        # Priority 2: Exact (word, pos) in internal 10,996-word bank
        if p and (k, p) in internal_gloss_by_pos:
            return internal_gloss_by_pos[(k, p)]

        # Priority 3: Contextual verb translation ("to <word>") for verbs!
        if p == "v":
            vc = cache.get(f"v:{k}", "")
            if vc and not is_english_definition_or_repeat(vc, k):
                return vc

        # Priority 4: Word-level curated TOEIC glossary
        if k in CURATED_TOEIC_GLOSSES:
            return CURATED_TOEIC_GLOSSES[k]

        # Priority 5: General internal 10,996-word bank fallback
        if k in internal_gloss_any:
            return internal_gloss_any[k]

        # Priority 6: General translation cache
        gc = cache.get(k, "")
        if gc and not is_english_definition_or_repeat(gc, k):
            return gc

        return None

    # Step 4: Write cleaned data back to all 16 decks + search-index.json
    print("[4/5] Applying same-root Word Family & POS-aware meanings to all 16 decks...")
    search_index_rows: List[dict] = []

    for dk in sorted(decks.keys()):
        p, data = decks[dk]
        for topic in data.get("topics", []):
            for w in topic.get("words", []):
                hw = w["word"]
                hw_key = normalize_key(hw)
                hw_pos = normalize_pos(w.get("pos", "n"))

                # Fix headword if (word, pos) is in curated POS overrides and currently mismatched
                if (hw_key, hw_pos) in CURATED_POS_GLOSSES:
                    desired_hw = CURATED_POS_GLOSSES[(hw_key, hw_pos)]
                    cur_hw = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                    if normalize_key(cur_hw) != normalize_key(desired_hw) and (
                        # Fix clear POS mismatches like train(v) == "tàu", deal == "Chia bài", etc.
                        (hw_key == "train" and hw_pos == "v")
                        or (hw_key == "groom" and hw_pos == "v")
                        or is_english_definition_or_repeat(cur_hw, hw_key)
                    ):
                        w["meaning"] = desired_hw
                        stats["headwords_pos_fixed"] += 1

                # Apply filtered + enriched same-root wordFamily with POS-aware meanings
                old_wf_map = {
                    normalize_key(item.get("word", "")): (item.get("meaning") or "").strip()
                    for item in w.get("wordFamily", [])
                }
                new_wf = []
                for wf_word, wf_pos in rebuilt_wf_cache.get(w["id"], []):
                    resolved_wf = resolve_pos_meaning(wf_word, wf_pos)
                    if not resolved_wf:
                        continue
                    old_m = old_wf_map.get(normalize_key(wf_word), "")
                    if old_m and normalize_key(old_m) != normalize_key(resolved_wf):
                        stats["wf_pos_meaning_fixed"] += 1
                    new_wf.append({
                        "word": wf_word,
                        "pos": wf_pos,
                        "meaning": resolved_wf,
                    })
                w["wordFamily"] = new_wf

                # Update relationMeanings with POS-aware lookup matching the headword's POS
                old_rel = w.get("relationMeanings", {}) or {}
                new_rel: Dict[str, str] = {}
                clean_syns: List[str] = []
                clean_ants: List[str] = []
                for s in w.get("synonyms", []):
                    sk = normalize_key(s)
                    gm = resolve_pos_meaning(s, hw_pos)
                    if gm:
                        clean_syns.append(s)
                        new_rel[sk] = gm
                        if old_rel.get(sk) and normalize_key(old_rel[sk]) != normalize_key(gm):
                            stats["rel_pos_meaning_fixed"] += 1
                for a in w.get("antonyms", []):
                    ak = normalize_key(a)
                    gm = resolve_pos_meaning(a, hw_pos)
                    if gm:
                        clean_ants.append(a)
                        new_rel[ak] = gm
                        if old_rel.get(ak) and normalize_key(old_rel[ak]) != normalize_key(gm):
                            stats["rel_pos_meaning_fixed"] += 1

                w["synonyms"] = clean_syns
                w["antonyms"] = clean_ants
                if new_rel:
                    w["relationMeanings"] = new_rel
                elif "relationMeanings" in w:
                    del w["relationMeanings"]

                final_meaning = re.sub(r"^\[[^\]]+\]\s*", "", (w.get("meaning") or "").strip()).strip()
                search_index_rows.append({
                    "id": w["id"],
                    "word": w["word"],
                    "meaningVi": final_meaning,
                    "ipaUS": w.get("ipaUS", ""),
                    "partOfSpeech": w.get("pos", "n"),
                    "deckId": w["deckId"],
                })

        if "words" in data and isinstance(data["words"], list):
            data["words"] = [w for t in data.get("topics", []) for w in t.get("words", [])]

        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Rebuild search-index.json with TOEIC priority order
    deck_rank = {dk: idx for idx, dk in enumerate(DECK_PRIORITY)}
    search_index_rows.sort(key=lambda r: (deck_rank.get(r["deckId"], 99), r["id"]))
    (VOCAB_DIR / "search-index.json").write_text(
        json.dumps(search_index_rows, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print("\n[5/5] SAME-ROOT & POS-AWARE CLEANING SUMMARY:")
    print(f"  • Cross-root Word Family items REMOVED:           {stats['wf_removed_wrong_root']}")
    print(f"  • Exact-lemma same-root Word Family items ADDED:  {stats['wf_added_exact_wn']}")
    print(f"  • Word Family meanings updated via POS lookup:    {stats['wf_pos_meaning_fixed']}")
    print(f"  • Headword POS mismatches fixed (e.g. train v):   {stats['headwords_pos_fixed']}")
    print(f"  • Syn/Ant relationMeanings updated via POS:       {stats['rel_pos_meaning_fixed']}")
    print(f"  • Total search-index.json rows rebuilt:           {len(search_index_rows)}")

    # Verify sample JSON of `training` (from toeic-600.json)
    t600 = decks["toeic-600"][1]
    for topic in t600.get("topics", []):
        for w in topic.get("words", []):
            if normalize_key(w["word"]) == "training":
                print("\n=== SAMPLE VERIFICATION: `training` (toeic-600.json) ===")
                print(json.dumps({
                    "id": w["id"],
                    "word": w["word"],
                    "pos": w["pos"],
                    "meaning": w["meaning"],
                    "wordFamily": w["wordFamily"],
                    "synonyms": w["synonyms"],
                    "antonyms": w["antonyms"],
                    "relationMeanings": w.get("relationMeanings", {}),
                }, ensure_ascii=False, indent=2))
                break


if __name__ == "__main__":
    main()
