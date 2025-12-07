'use strict';

/**
 * Script cập nhật mô tả chi tiết chuyên nghiệp cho sản phẩm
 * Tham khảo: Nike, Adidas, Ananas, Juno
 */

const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://clickjacking_user:VqysEFnX4EwNwCvwRihCGXgxP9ONOKA1@dpg-d4kmpafpm1nc738btuo0-a.singapore-postgres.render.com/clickjacking';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
});

// Mẫu mô tả chi tiết theo từng loại
const descriptions = {
  sportMen: [
    `Thiết kế hiện đại với đường nét năng động, giày thể thao nam này là sự lựa chọn hoàn hảo cho những ai yêu thích phong cách thể thao đường phố. Phần upper được làm từ chất liệu vải mesh thoáng khí cao cấp, kết hợp cùng lớp phủ synthetic bền bỉ, mang đến sự thoải mái tối đa trong suốt cả ngày dài vận động.

Đế giữa EVA cao cấp với công nghệ đệm êm ái, hỗ trợ hấp thụ lực chấn động hiệu quả, bảo vệ đôi chân khỏi những tác động mạnh khi chạy bộ hay tập luyện. Đế ngoài bằng cao su tổng hợp có độ bám dính cao, chống trượt tốt trên nhiều bề mặt khác nhau.

Thiết kế cổ giày ôm vừa vặn, tạo cảm giác an toàn nhưng không gò bó. Lưỡi gà và cổ giày có lót đệm mềm mại, ngăn ngừa trầy xước và mang lại sự êm ái. Hệ thống dây buộc chắc chắn, dễ dàng điều chỉnh độ rộng phù hợp với bàn chân.

Phù hợp cho: Chạy bộ, tập gym, đi bộ, hoạt động thể thao ngoài trời và phong cách casual hàng ngày. Sản phẩm có nhiều size từ 39-43, phù hợp với đa dạng kích cỡ bàn chân.`,

    `Khám phá đỉnh cao của sự thoải mái với mẫu giày thể thao nam cao cấp này. Được chế tác từ chất liệu vải knit đàn hồi, ôm sát bàn chân như "bàn tay thứ hai", mang đến trải nghiệm đi bộ mượt mà và nhẹ nhàng. Công nghệ Flyknit độc quyền giúp tối ưu hóa độ thông thoáng, giữ cho đôi chân luôn khô ráo và mát mẻ.

Hệ thống đế Boost năng lượng với hàng ngàn viên nang TPU, cung cấp khả năng đàn hồi vượt trội, giúp bạn vận động nhanh nhạy và bền bỉ hơn. Mỗi bước chân đều được hỗ trợ tối đa, giảm thiểu mệt mỏi ngay cả khi hoạt động trong thời gian dài.

Phần gót được thiết kế cao hơn, tạo độ ổn định và hỗ trợ vòm bàn chân hiệu quả. Đế ngoài Continental Rubber chống mài mòn, độ bền cao, duy trì độ bám tốt ngay cả trên bề mặt ướt. Màu sắc hiện đại, dễ dàng phối hợp với nhiều trang phục khác nhau.

Ứng dụng: Chạy marathon, chạy đường dài, training thể lực, hoặc sử dụng hàng ngày. Chất lượng được kiểm nghiệm nghiêm ngặt, cam kết mang đến trải nghiệm tốt nhất.`,

    `Mẫu giày thể thao nam performance cao cấp với thiết kế tối giản nhưng đầy tinh tế. Upper kết hợp giữa da tổng hợp cao cấp và vải mesh thoáng khí, tạo nên vẻ ngoài sang trọng đồng thời đảm bảo tính năng vượt trội. Các đường chỉ may tỉ mỉ, chắc chắn, thể hiện sự chú trọng đến từng chi tiết.

Công nghệ Air Cushion ẩn trong đế giữa, cung cấp lực đệm êm ái và phản hồi năng lượng tức thời, giúp bạn di chuyển nhanh hơn, nhẹ nhàng hơn. Phần midfoot được gia cố bằng TPU, tăng độ ổn định khi thực hiện các chuyển động đa hướng.

Thiết kế đế ngoài với các rãnh flex đặc biệt, tăng độ uốn tự nhiên của bàn chân, đồng thời tối ưu hóa lực kéo trên nhiều bề mặt. Lớp lót bên trong làm từ vải kháng khuẩn, ngăn mùi hôi và dễ dàng vệ sinh.

Thích hợp cho: Bóng rổ, cầu lông, tennis, hoặc mặc thường ngày. Phong cách thể thao năng động, phù hợp với xu hướng streetwear hiện đại.`,
  ],

  sportWomen: [
    `Giày thể thao nữ với thiết kế thanh lịch và nữ tính, kết hợp hoàn hảo giữa phong cách và chức năng. Chất liệu mesh mềm mại, thoáng khí, được bọc overlay da lộn synthetic cao cấp, tạo nên vẻ ngoài sang trọng nhưng không kém phần năng động. Màu sắc pastel nhẹ nhàng, dễ dàng phối đồ với nhiều outfit khác nhau.

Đế giữa EVA siêu nhẹ với công nghệ đệm Cloud Foam, mang đến cảm giác êm ái như đi trên mây. Hỗ trợ vòm bàn chân và giảm áp lực lên gót chân, giúp bạn thoải mái suốt cả ngày dài. Phần gót có độ nâng vừa phải, tạo tư thế đi đứng chuẩn mực và tôn dáng.

Đế ngoài cao su non-marking, không để lại vết trên sàn nhà, phù hợp cho tập luyện trong nhà. Kết cấu chống trượt hiệu quả, an toàn khi di chuyển trên các bề mặt trơn. Lưỡi gà mềm mại, cổ giày ôm sát nhưng không gây khó chịu.

Ứng dụng: Yoga, Zumba, Aerobic, gym, hoặc đi bộ thường ngày. Thiết kế tôn vinh vẻ đẹp của người phụ nữ hiện đại - năng động, tự tin và phong cách.`,

    `Trải nghiệm sự kết hợp hoàn hảo giữa công nghệ và thời trang với đôi giày thể thao nữ này. Phần upper được dệt từ sợi Primeknit cao cấp, ôm chân tự nhiên như tất, tối ưu hóa sự linh hoạt và thoải mái. Không có đường may gây khó chịu, tạo cảm giác mượt mà và êm ái trong mọi chuyển động.

Công nghệ React Foam đế giữa, mang đến độ đàn hồi vượt trội, giúp bạn bật nhảy cao hơn, chạy nhanh hơn mà vẫn bảo vệ đôi chân khỏi chấn thương. Trọng lượng siêu nhẹ, chỉ khoảng 200g, giúp giảm gánh nặng cho bàn chân khi vận động.

Thiết kế outsole với pattern hình xương cá, tăng ma sát và độ bám tối ưu. Màu sắc gradient độc đáo, pha trộn giữa các tông màu trendy, tạo điểm nhấn ấn tượng cho outfit. Phù hợp với các cô gái trẻ yêu thích sự nổi bật và cá tính.

Phù hợp cho: Chạy bộ buổi sáng, cardio, các lớp fitness, hoặc phối đồ streetwear. Kích cỡ từ 36-40, đáp ứng nhu cầu đa dạng của phái đẹp.`,

    `Giày thể thao nữ phong cách minimalist với thiết kế tinh tế, đơn giản nhưng tinh tế. Sử dụng chất liệu da tổng hợp cao cấp, dễ vệ sinh, bền màu theo thời gian. Tone màu basic dễ phối, phù hợp cả trang phục thể thao lẫn casual hàng ngày.

Công nghệ đệm SoftFoam+ bên trong, ôm lấy bàn chân với độ êm ái tối đa ngay từ lần đi đầu tiên. Lớp lót ortholite kháng khuẩn, giúp hạn chế mùi hôi và giữ cho đôi chân luôn khô thoáng. Đế giữa có độ cao vừa phải, không gây mệt mỏi khi đứng lâu.

Đế ngoài làm từ cao su tái chế thân thiện môi trường, độ bám cao, chống mài mòn. Thiết kế rãnh flex giúp bàn chân uốn cong tự nhiên, tăng cảm giác thoải mái. Phần gót được gia cố chắc chắn, tạo độ ổn định tốt.

Sử dụng cho: Đi làm, đi học, dạo phố, cafe, hoặc các hoạt động thể thao nhẹ nhàng. Phong cách tối giản nhưng tinh tế, phù hợp với phụ nữ yêu thích sự thanh lịch.`,
  ],

  officeMen: [
    `Giày công sở nam da bò thật cao cấp, thiết kế Oxford cổ điển mang đến vẻ lịch lãm và chuyên nghiệp. Bề mặt da được đánh bóng sáng bóng, dễ dàng chùi sạch và luôn giữ được vẻ ngoài sang trọng. Đường khâu tỉ mỉ, chắc chắn, thể hiện sự tinh xảo trong từng chi tiết.

Lớp lót bên trong làm từ da cừu mềm mại, tạo cảm giác thoải mái tuyệt đối cho bàn chân. Đế trong có thiết kế hỗ trợ vòm bàn chân, giảm căng thẳng cơ và ngăn ngừa đau chân khi phải đứng hoặc đi lại nhiều. Phần gót được gia cố, tạo độ ổn định và hỗ trợ tốt cho khớp cổ chân.

Đế ngoài bằng cao su tự nhiên pha TPR, chống trượt tốt trên sàn nhà và bề mặt ướt. Độ bền cao, không bị mòn nhanh ngay cả khi sử dụng thường xuyên. Thiết kế đế phẳng chuẩn, tạo tư thế đi đứng thẳng và chuyên nghiệp.

Phù hợp cho: Môi trường văn phòng, họp hành, sự kiện doanh nghiệp, tiệc tối, hoặc các dịp trang trọng. Đây là item must-have trong tủ giày của mọi quý ông thành đạt.`,

    `Giày tây nam Derby phong cách Anh quốc, kết hợp giữa sự thanh lịch và hiện đại. Chất liệu da bò Italian cao cấp, được thuộc và xử lý theo quy trình chuẩn Châu Âu, mềm mại nhưng cực kỳ bền bỉ. Màu đen hoặc nâu trơn, dễ dàng phối hợp với suit, blazer, hoặc quần âu.

Công nghệ Goodyear Welt - phương pháp đính đế cổ điển, đảm bảo độ bền vượt trội và có thể thay đế nhiều lần. Đế giữa bằng da hoặc cork tự nhiên, tạo độ êm ái và thoáng khí cho bàn chân. Cấu trúc giày được thiết kế để "ôm" bàn chân hơn theo thời gian, tạo cảm giác vừa vặn như được đo riêng.

Mũi giày hơi nhọn, tôn dáng và tạo vẻ thanh mảnh cho đôi chân. Hệ thống dây buộc chắc chắn, kết hợp với lưỡi gà cứng, giữ form giày đẹp lâu dài. Đế ngoài bằng da hoặc cao su tổng hợp, có độ bền cao và chống trượt tốt.

Sử dụng cho: Đám cưới, gala, họp mặt doanh nhân, phỏng vấn việc làm, hoặc các sự kiện quan trọng. Thể hiện đẳng cấp và phong thái của người đàn ông hiện đại.`,

    `Giày công sở nam Loafer không dây - sự lựa chọn hoàn hảo cho quý ông bận rộn. Thiết kế slip-on tiện lợi, dễ dàng đi và tháo mà vẫn giữ được sự trang trọng. Chất liệu da bò thật hoặc da tổng hợp cao cấp, bền đẹp và dễ bảo quản.

Phần mũi giày có trang trí kim loại nhỏ gọn, tạo điểm nhấn tinh tế. Phần vamp được cắt thấp, tạo vẻ nhẹ nhàng và thoải mái hơn so với giày buộc dây truyền thống. Đường viền được khâu thủ công, đảm bảo độ chính xác và thẩm mỹ cao.

Lớp lót bên trong có đệm êm ái, hỗ trợ gót chân và vòm bàn chân. Đế trong có lỗ thông hơi, giúp tuần hoàn không khí và giảm mùi hôi. Đế ngoài cao su tổng hợp hoặc EVA, nhẹ nhàng và êm ái, phù hợp để đi lại cả ngày.

Thích hợp cho: Văn phòng business casual, meeting khách hàng, đi làm hàng ngày, hoặc các buổi gặp gỡ không quá trang trọng. Phong cách smart casual, vừa lịch sự vừa tiện dụng.`,
  ],

  officeWomen: [
    `Giày cao gót công sở nữ với chiều cao 5-7cm lý tưởng, giúp tôn dáng mà vẫn thoải mái khi di chuyển cả ngày. Thiết kế mũi nhọn cổ điển, giúp đôi chân trở nên thanh mảnh và quyến rũ hơn. Chất liệu da bò thật hoặc da PU cao cấp, mịn màng và bóng đẹp.

Phần cổ giày được thiết kế ôm vừa vặn, không gây phồng rộp hay trầy xước gót chân. Lớp lót bên trong có đệm mút memory foam, ôm sát và tạo cảm giác êm ái. Đế trong có thiết kế hỗ trợ vòm bàn chân, giảm mệt mỏi khi phải đứng hoặc đi lại nhiều.

Gót giày ổn định, không bị lay động, đảm bảo an toàn khi di chuyển. Đế ngoài cao su non-slip, chống trượt tốt ngay cả trên bề mặt trơn. Màu sắc cơ bản như đen, nude, nâu, dễ dàng phối với mọi trang phục công sở.

Phù hợp cho: Môi trường văn phòng, họp hành, thuyết trình, sự kiện doanh nghiệp. Thể hiện sự chuyên nghiệp, tự tin và phong cách của người phụ nữ hiện đại.`,

    `Giày búp bê công sở nữ - sự lựa chọn thông minh cho những ngày làm việc dài. Thiết kế đế bệt thoải mái, phù hợp với phụ nữ không quen với giày cao gót hoặc cần di chuyển nhiều. Chất liệu da bóng hoặc da lộn, tạo vẻ nhẹ nhàng và thanh lịch.

Mũi giày tròn hoặc hơi nhọn, ôm vừa vặn phần đầu bàn chân mà không gò bó. Phần vamp được đục lỗ trang trí hoặc thêu họa tiết tinh tế, tạo điểm nhấn cho đôi giày. Viền giày được khâu tỉ mỉ, chắc chắn, đảm bảo độ bền cao.

Đế trong có lớp đệm mềm mại, kết hợp với công nghệ Arch Support, giúp bàn chân không bị mệt mỏi. Đế ngoài cao su tổng hợp, độ dày vừa phải, mang lại sự êm ái khi đi trên nhiều bề mặt khác nhau. Trọng lượng nhẹ, dễ dàng mang theo khi cần thiết.

Sử dụng cho: Văn phòng, đi làm, họp khách hàng, hoặc các buổi gặp gỡ business casual. Phong cách thanh lịch, nữ tính mà vẫn đảm bảo sự thoải mái tối đa.`,

    `Giày slingback cao gót nữ - xu hướng thời trang công sở hiện đại. Thiết kế quai hậu điều chỉnh được, dễ dàng mang vào và cởi ra, vừa tiện lợi lại vừa giữ được sự trang trọng. Chiều cao gót 3-5cm, phù hợp cả những ai mới làm quen với giày cao gót.

Phần mũi giày có thể là mũi vuông hoặc mũi nhọn, tùy theo phong cách cá nhân. Chất liệu da bóng, da nubuck, hoặc vải tweed cao cấp, mang đến vẻ ngoài sang trọng. Màu sắc đa dạng từ trung tính đến pastel nhẹ nhàng, dễ phối đồ.

Lớp lót bên trong mềm mại, không gây cọ xát. Đế trong có lớp gel hấp thụ sốc, bảo vệ khớp gối và cột sống khi di chuyển. Gót giày được thiết kế cân đối, tạo độ ổn định cao, không bị lắc lư khi bước đi.

Thích hợp cho: Văn phòng, buổi họp, sự kiện networking, hoặc các buổi tiệc nhẹ. Sự kết hợp hoàn hảo giữa phong cách chuyên nghiệp và nét nữ tính hiện đại.`,
  ],

  sandalMen: [
    `Giày sandal nam quai ngang phong cách sporty, thiết kế năng động và khỏe khoắn. Quai giày làm từ vải dù chống nước, kết hợp cùng nhựa TPU bền chắc, có thể điều chỉnh độ rộng vừa vặn với bàn chân. Hệ thống Velcro hoặc khóa cài nhanh, tiện lợi khi mang và tháo.

Đế giày bằng EVA cao cấp, siêu nhẹ và mềm mại, tạo cảm giác êm ái tối đa. Thiết kế contouring ôm sát bàn chân, hỗ trợ vòm bàn chân và giảm áp lực lên gót. Bề mặt đế có texture chống trượt, an toàn khi đi trên bề mặt ướt.

Phong cách outdoor, phù hợp cho các hoạt động như đi biển, leo núi nhẹ, cắm trại, hoặc dạo phố. Chất liệu chống nước, dễ dàng vệ sinh, nhanh khô. Màu sắc trung tính hoặc tông đất, phù hợp với phong cách nam tính và mạnh mẽ.

Ứng dụng: Đi du lịch, picnic, bãi biển, công viên, hoặc mặc thường ngày trong mùa hè. Sự kết hợp hoàn hảo giữa tiện dụng và thời trang.`,

    `Sandal da nam cao cấp với thiết kế minimalist sang trọng. Quai giày làm từ da bò thật hoặc da tổng hợp cao cấp, mềm mại và bền bỉ theo thời gian. Kiểu dáng simple nhưng tinh tế, phù hợp với phong cách lịch lãm và trang nhã.

Đế trong làm từ da lộn hoặc vải cotton thoáng khí, tạo cảm giác thoải mái và cao cấp. Phần gót có độ nâng nhẹ, hỗ trợ tư thế đi đứng tự nhiên. Đế ngoài bằng cao su tổng hợp hoặc PU, độ bền cao, chống mài mòn tốt.

Thiết kế thong sandal hoặc slide, dễ dàng mang vào và cởi ra. Màu sắc trung tính như đen, nâu, tan, dễ phối hợp với nhiều trang phục khác nhau. Trọng lượng nhẹ, không gây cảm giác nặng nề cho đôi chân.

Phù hợp cho: Đi cafe, dạo phố, du lịch, hoặc mặc tại nhà. Phong cách smart casual, vừa thoải mái vừa lịch sự, thể hiện gu thẩm mỹ tinh tế của người đàn ông hiện đại.`,

    `Giày sandal nam thể thao với thiết kế đế dày trendy. Sử dụng công nghệ đế Chunky Sole, tạo độ cao và cá tính cho người đi. Phần upper kết hợp nhiều chất liệu như vải mesh, dây nylon, và plastic moulded, tạo vẻ ngoài hiện đại và năng động.

Quai giày có thể điều chỉnh linh hoạt, ôm sát bàn chân nhưng không gò bó. Lớp lót bên trong có đệm êm ái, thoáng khí. Đế giữa EVA siêu nhẹ, kết hợp cùng công nghệ Air Cushion, mang đến sự êm ái vượt trội.

Đế ngoài cao su có rãnh sâu, tăng độ bám và ma sát, an toàn khi di chuyển. Màu sắc đa dạng, từ tone đơn sắc đến phối màu neon nổi bật, phù hợp với giới trẻ yêu thích sự khác biệt.

Sử dụng cho: Streetwear, festival, đi chơi, hoặc các hoạt động outdoor. Phong cách Gen Z, năng động và cá tính, thể hiện sự tự do và sáng tạo.`,
  ],

  sandalWomen: [
    `Giày sandal nữ cao gót thanh lịch, thiết kế quai mảnh tinh tế, tôn vinh vẻ đẹp nữ tính và quyến rũ. Chiều cao gót 7-9cm, tạo tư thế đứng thẳng và giúp đôi chân trông dài hơn. Quai giày làm từ da mềm hoặc satin cao cấp, có thể có đính đá hoặc kim loại trang trí.

Thiết kế quai chéo hoặc quai chữ T, ôm vừa vặn bàn chân mà vẫn tạo cảm giác thoáng đãng. Dây đai cổ chân có thể điều chỉnh, đảm bảo độ vừa vặn và an toàn khi di chuyển. Phần gót giày chắc chắn, có thể là kiểu stiletto mảnh hoặc block heel ổn định.

Đế trong có lớp đệm gel hấp thụ sốc, giảm áp lực lên bàn chân. Đế ngoài cao su non-slip, chống trượt tốt. Màu sắc đa dạng từ nude, đen, bạc, vàng đồng, phù hợp với nhiều dịp khác nhau.

Phù hợp cho: Dự tiệc, dạ hội, đám cưới, sự kiện trang trọng, hoặc hẹn hò lãng mạn. Thể hiện sự quyến rũ, sang trọng và đẳng cấp của người phụ nữ.`,

    `Sandal nữ đế bệt bohemian với thiết kế thoải mái và phóng khoáng. Quai giày làm từ da thuộc hoặc vải thổ cẩm, có thêu họa tiết dân tộc hoặc đính cườm, tạo vẻ độc đáo và nghệ thuật. Kiểu dáng flat hoặc đế xuồng thấp, phù hợp cho những ngày dạo phố hoặc đi du lịch.

Thiết kế thong sandal hoặc gladiator với nhiều dây quai quấn quanh bàn chân, vừa cá tính vừa nữ tính. Chất liệu mềm mại, không gây cọ xát hay phồng rộp. Đế trong bằng da lộn hoặc vải cotton, thoáng mát và thấm hút mồ hôi.

Đế ngoài bằng cao su tổng hợp hoặc đế xuồng bằng cork, nhẹ nhàng và êm ái. Màu sắc earth tone hoặc pastel nhẹ nhàng, phù hợp với phong cách boho chic. Có thể phối cùng váy maxi, short jean, hoặc jumpsuit.

Sử dụng cho: Đi biển, du lịch, picnic, festival, hoặc dạo phố cuối tuần. Phong cách tự do, gần gũi với thiên nhiên, thể hiện cá tính của người phụ nữ hiện đại.`,

    `Giày sandal nữ thể thao chic với thiết kế platform đế dày. Sử dụng công nghệ đế EVA siêu nhẹ, tạo độ cao 3-5cm mà vẫn thoải mái khi di chuyển. Quai giày bằng vải canvas hoặc webbing chống nước, có thể điều chỉnh linh hoạt.

Thiết kế sporty nhưng vẫn thời trang, phù hợp với xu hướng athleisure hiện đại. Màu sắc đa dạng từ pastel đến neon, dễ dàng mix & match với nhiều outfit. Có thể phối cùng váy, quần shorts, hoặc jeans.

Lớp lót bên trong có đệm êm ái, hỗ trợ vòm bàn chân tốt. Đế ngoài có pattern chống trượt, an toàn khi đi trên nhiều địa hình. Trọng lượng nhẹ, dễ dàng mang theo khi đi du lịch.

Thích hợp cho: Đi chơi, shopping, cafe, hoặc các hoạt động outdoor nhẹ nhàng. Phong cách năng động, trẻ trung, phù hợp với các cô gái Gen Z yêu thích sự thoải mái và phong cách.`,
  ],

  sneaker: [
    `Sneaker unisex phong cách retro với thiết kế lấy cảm hứng từ những năm 80s-90s. Phần upper kết hợp giữa da tổng hợp, da lộn, và vải canvas, tạo nên vẻ ngoài vintage đầy cá tính. Màu sắc phối tone độc đáo, từ classic white/black đến các tông màu neon nổi bật.

Công nghệ đế Cupsole cổ điển, bọc toàn bộ phần đế giữa, tạo độ bền cao và form giày đẹp. Đệm EVA kết hợp với Ortholite insole, mang đến sự thoải mái cả ngày dài. Phần mũi giày có lớp bảo vệ cao su, chống mài mòn hiệu quả.

Thiết kế low-top hoặc mid-top, phù hợp với nhiều phong cách khác nhau. Dây giày dẹt hoặc tròn, có thể thay đổi màu sắc để customize theo ý thích. Logo thương hiệu được đặt tinh tế, không quá phô trương.

Ứng dụng: Skateboarding, streetwear, casual daily, hoặc đi chơi. Phù hợp cả nam và nữ, đa dạng size từ 36-43. Phong cách unisex, cá tính, thể hiện sự tự do và sáng tạo.`,

    `Sneaker chunky unisex với thiết kế đế dày trendy, tạo trend trong giới trẻ. Phần upper phối nhiều chất liệu như leather, mesh, suede, tạo vẻ ngoài phức tạp và đầy nghệ thuật. Màu sắc đa dạng từ monochrome đến multi-color, phù hợp với nhiều outfit khác nhau.

Công nghệ đế Chunky Sole với chiều cao 4-6cm, tôn dáng và tạo điểm nhấn ấn tượng. Đế giữa EVA siêu nhẹ, kết hợp công nghệ Air Max, mang đến sự êm ái và đàn hồi tuyệt vời. Đế ngoài cao su có độ bám cao, chống trượt tốt.

Thiết kế dây buộc phức tạp, tạo vẻ ngoài technical và hiện đại. Logo thương hiệu to bản, nổi bật trên thân giày. Phần lưỡi gà dày, có padding êm ái, tăng độ thoải mái khi mang.

Sử dụng cho: Streetwear, casual fashion, đi chơi, hoặc tạo style statement. Phù hợp với giới trẻ yêu thích xu hướng thời trang đương đại. Thể hiện cá tính mạnh mẽ và phong cách độc đáo.`,

    `Sneaker minimalist unisex với thiết kế tối giản, tinh tế. Sử dụng chất liệu da hoặc canvas cao cấp, tone màu basic như white, black, grey, dễ dàng phối đồ. Không có nhiều đường nét rườm rà, tạo vẻ ngoài clean và sang trọng.

Công nghệ đế Cup Sole hoặc Vulcanized, mang đến độ bền cao và cảm giác "board feel" tốt. Đệm Ortholite bên trong, kháng khuẩn và thoáng khí. Trọng lượng nhẹ, thoải mái khi di chuyển cả ngày.

Thiết kế low-top với form giày slim, tôn dáng và tạo vẻ gọn gàng. Dây giày mảnh, khóa cài kín đáo. Logo thương hiệu được đặt nhỏ gọn, không quá nổi bật. Đế ngoài có độ dày vừa phải, không quá cao cũng không quá mỏng.

Phù hợp cho: Minimalist fashion, smart casual, đi làm, đi học, hoặc dạo phố. Style evergreen, không bao giờ lỗi mốt. Phù hợp với những ai yêu thích sự đơn giản nhưng tinh tế.`,
  ],
};

async function updateDescriptions() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    console.log('📝 Updating product descriptions...');

    // Lấy tất cả sản phẩm
    const products = await sequelize.query(
      `SELECT p."ProductID", p."Name", c."Name" as "CategoryName"
       FROM "Products" p
       JOIN "Categories" c ON p."CategoryID" = c."CategoryID"
       ORDER BY c."Name", p."ProductID"`,
      { type: QueryTypes.SELECT }
    );

    let updateCount = 0;
    
    for (const product of products) {
      let descArray;
      const categoryName = product.CategoryName;
      
      // Chọn mô tả dựa trên category
      if (categoryName === 'Giày Thể Thao Nam') {
        descArray = descriptions.sportMen;
      } else if (categoryName === 'Giày Thể Thao Nữ') {
        descArray = descriptions.sportWomen;
      } else if (categoryName === 'Giày Công Sở Nam') {
        descArray = descriptions.officeMen;
      } else if (categoryName === 'Giày Công Sở Nữ') {
        descArray = descriptions.officeWomen;
      } else if (categoryName === 'Giày Sandal Nam') {
        descArray = descriptions.sandalMen;
      } else if (categoryName === 'Giày Sandal Nữ') {
        descArray = descriptions.sandalWomen;
      } else if (categoryName === 'Sneaker Unisex') {
        descArray = descriptions.sneaker;
      }

      if (descArray) {
        // Lấy mô tả ngẫu nhiên từ mảng
        const randomDesc = descArray[Math.floor(Math.random() * descArray.length)];
        
        await sequelize.query(
          `UPDATE "Products" SET "Description" = :desc WHERE "ProductID" = :id`,
          {
            replacements: { desc: randomDesc, id: product.ProductID }
          }
        );
        
        updateCount++;
        if (updateCount % 10 === 0) {
          console.log(`  Updated ${updateCount}/${products.length} products...`);
        }
      }
    }

    console.log(`\n✅ Updated ${updateCount} product descriptions!`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

updateDescriptions();
