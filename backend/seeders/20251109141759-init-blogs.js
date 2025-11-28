'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert('Blogs', [
      // 1. Slingback
      {
        Title: 'Top 5 mẫu giày slingback nên có trong tủ giày của mỗi cô nàng',
        Content: `
          <p>
            Giày slingback là kiểu giày với phần quai sau ôm nhẹ gót chân, mang lại cảm giác thoáng chân 
            nhưng vẫn đủ chắc chắn và thanh lịch. Đây là một trong những mẫu giày “dễ tính” vì có thể 
            đi làm, đi chơi, đi tiệc đều phù hợp.
          </p>

          <p>
            Trong bài viết này, chúng ta sẽ cùng điểm qua 5 mẫu giày slingback tiêu biểu mà bất kỳ cô nàng 
            yêu thời trang nào cũng nên có trong tủ giày của mình – kèm gợi ý phối đồ và lưu ý chọn size.
          </p>

          <h2>1. Slingback mũi nhọn gót vừa – lựa chọn an toàn cho nàng công sở</h2>
          <p>
            Mẫu slingback mũi nhọn với phần gót cao khoảng 5–7 cm là lựa chọn lý tưởng cho môi trường công sở. 
            Thiết kế mũi nhọn giúp bàn chân trông thon gọn hơn, trong khi gót vừa phải vẫn đảm bảo sự thoải mái 
            khi di chuyển cả ngày.
          </p>
          <ul>
            <li>Phù hợp với: váy bút chì, quần tây, chân váy midi.</li>
            <li>Màu nên chọn: đen, nude, be để dễ phối và ít lỗi mốt.</li>
            <li>Lưu ý: ưu tiên chất liệu da mềm, phần quai sau ôm vừa gót chân.</li>
          </ul>

          <h2>2. Slingback gót vuông – bạn đồng hành cho ngày dài di chuyển</h2>
          <p>
            Nếu công việc của bạn cần đứng hoặc đi lại nhiều, hãy cân nhắc các mẫu slingback gót vuông. 
            Gót vuông tạo cảm giác vững chãi, ít đau chân hơn so với gót nhọn truyền thống.
          </p>
          <p>
            Kiểu giày này rất hợp với phong cách smart casual: áo sơ mi, quần jeans tối màu, blazer nhẹ. 
            Chỉ cần thay đổi một chút phụ kiện là bạn đã có thể chuyển từ outfit đi làm sang đi cà phê, 
            gặp gỡ bạn bè.
          </p>

          <h2>3. Slingback đính nơ/hoa – điểm nhấn cho các buổi tiệc</h2>
          <p>
            Với những buổi tiệc, sự kiện hay hẹn hò, các mẫu slingback có chi tiết trang trí như nơ, hoa, đá 
            hoặc chất liệu satin sẽ giúp tổng thể outfit nổi bật hơn mà không cần quá nhiều phụ kiện.
          </p>
          <ul>
            <li>Kết hợp đẹp với: váy xòe, slip dress, đầm suông đơn giản.</li>
            <li>Mẹo nhỏ: vì giày đã là điểm nhấn, hãy chọn trang phục ít họa tiết để tránh rối mắt.</li>
          </ul>

          <h2>4. Slingback tông nude – “vũ khí” kéo dài đôi chân</h2>
          <p>
            Một đôi slingback màu nude gần với tông da chân sẽ tạo hiệu ứng thị giác giúp chân trông dài hơn. 
            Đây là “vũ khí” không thể thiếu của những nàng có chiều cao khiêm tốn hoặc dáng người nhỏ nhắn.
          </p>

          <h2>5. Slingback màu sắc/hoạ tiết – dành cho ngày bạn muốn khác biệt</h2>
          <p>
            Bên cạnh các tông màu cơ bản, hãy thử một đôi slingback màu sắc nổi bật hoặc hoạ tiết nhẹ nhàng. 
            Đây là lựa chọn lý tưởng cho những ngày bạn muốn thay đổi phong cách, tạo dấu ấn cá nhân.
          </p>

          <h2>Cách chọn size giày slingback đi êm chân</h2>
          <ul>
            <li>Đo chiều dài bàn chân và so với bảng size của từng thương hiệu.</li>
            <li>Nếu chân hơi bè ngang, ưu tiên form mũi ít nhọn hoặc mũi tròn.</li>
            <li>Đối với thiết kế quai sau, hãy thử đi vài bước để chắc chắn gót không bị tuột.</li>
          </ul>

          <h2>Gợi ý phối đồ</h2>
          <p><strong>Đi làm:</strong> Slingback gót vừa + quần tây + sơ mi + blazer.</p>
          <p><strong>Đi chơi:</strong> Slingback gót vuông + jeans ống đứng + áo phông basic.</p>
          <p><strong>Dự tiệc:</strong> Slingback đính nơ/hoa + váy midi hoặc slip dress.</p>

          <h2>Kết luận</h2>
          <p>
            Tùy vào phong cách và nhu cầu sử dụng, bạn có thể bắt đầu với một đôi slingback basic màu đen hoặc nude, 
            sau đó dần bổ sung các thiết kế đặc biệt hơn cho tủ giày của mình.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-slingback.jpg',
        IsActive: true,
        CreatedAt: now
      },

      // 2. Tips phối đồ chân thon
      {
        Title: 'Bật mí 7 tips phối đồ giúp đôi chân trông thon gọn hơn',
        Content: `
          <p>
            Không phải ai sinh ra cũng có đôi chân thon dài, nhưng với một vài mẹo phối đồ thông minh, 
            bạn hoàn toàn có thể “ăn gian” đáng kể về mặt thị giác. Dưới đây là 7 tips đơn giản, dễ áp dụng 
            nhưng mang lại hiệu quả rõ rệt.
          </p>

          <h2>1. Ưu tiên quần cạp cao</h2>
          <p>
            Quần cạp cao giúp kéo dài phần chân, tạo tỷ lệ cơ thể “3 phần 7” lý tưởng hơn. 
            Bạn có thể chọn quần tây, quần jeans hoặc chân váy cạp cao tuỳ phong cách.
          </p>

          <h2>2. Chọn phom quần ống đứng hoặc hơi suông</h2>
          <p>
            Quần ôm sát dễ “tố cáo” khuyết điểm bắp chân to, trong khi quần ống đứng hoặc hơi suông 
            sẽ tạo đường thẳng từ hông xuống mắt cá, khiến chân trông gọn hơn.
          </p>

          <h2>3. Tránh chi tiết ngang cắt ngang bắp chân</h2>
          <p>
            Các chi tiết như dây buộc ở cổ chân, quai ngang dày, hay váy dài đến giữa bắp chân 
            rất dễ làm chân bị “đứt khúc”. Hãy ưu tiên độ dài đến đầu gối hoặc qua bắp chân hẳn.
          </p>

          <h2>4. Giày mũi nhọn – người bạn thân của đôi chân</h2>
          <p>
            Giày mũi nhọn tạo hiệu ứng đôi chân dài hơn. Bạn không nhất thiết phải chọn gót quá cao, 
            gót vừa 5–7 cm là đủ để vừa tôn dáng vừa giữ được sự thoải mái.
          </p>

          <h2>5. Chọn màu giày tiệp với màu da hoặc màu quần/váy</h2>
          <p>
            Khi giày “tiệp màu” với da chân hoặc quần/váy, mắt người đối diện sẽ không bị phân đoạn, 
            từ đó tạo cảm giác chân dài và liền mạch hơn.
          </p>

          <h2>6. Sử dụng hoạ tiết dọc, tránh hoạ tiết ngang</h2>
          <p>
            Các đường kẻ dọc hoặc phom cắt dọc giúp cơ thể “cao” lên, trong khi chi tiết ngang 
            dễ làm cơ thể trông “phổ” ra hai bên – nhất là phần đùi và bắp chân.
          </p>

          <h2>7. Đừng quên tư thế đứng và dáng đi</h2>
          <p>
            Dù outfit có tinh chỉnh kỹ đến đâu, nếu tư thế gù lưng, chân bước không vững thì tổng thể 
            vẫn không đẹp. Hãy giữ lưng thẳng, vai mở và bước đi tự tin – đó là “bí quyết” quan trọng nhất.
          </p>

          <h2>Kết luận</h2>
          <p>
            Chân thon gọn không chỉ đến từ vóc dáng tự nhiên mà còn từ cách bạn lựa chọn trang phục và giày dép. 
            Hãy thử áp dụng từng tips nhỏ trong bài viết này và tự quan sát sự thay đổi của bản thân qua từng ngày.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-tips-chan-thon.jpg',
        IsActive: true,
        CreatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      },

      // 3. Chọn size giày online
      {
        Title: 'Hướng dẫn chọn size giày online chuẩn hơn, hạn chế bị chật hoặc rộng',
        Content: `
          <p>
            Mua giày online tiết kiệm thời gian nhưng cũng tiềm ẩn rủi ro “đặt một đằng, đi một nẻo” 
            nếu chọn sai size. Để hạn chế tối đa việc đổi trả, bạn nên nắm rõ cách đo chân, 
            hiểu bảng size và một vài lưu ý quan trọng.
          </p>

          <h2>1. Chuẩn bị trước khi đo</h2>
          <ul>
            <li>Một tờ giấy trắng lớn hơn bàn chân.</li>
            <li>Bút chì hoặc bút bi.</li>
            <li>Thước kẻ.</li>
            <li>Một đôi tất nếu bạn thường mang giày với tất.</li>
          </ul>

          <h2>2. Cách đo chiều dài bàn chân</h2>
          <p>
            Đặt bàn chân lên tờ giấy, đứng thẳng, dồn đều trọng lượng lên cả hai chân. 
            Dùng bút vẽ theo viền bàn chân, sau đó dùng thước đo khoảng cách từ đầu ngón chân dài nhất 
            đến cuối gót chân. Đó là chiều dài bàn chân thực tế.
          </p>

          <h2>3. So sánh với bảng size của hãng</h2>
          <p>
            Mỗi thương hiệu có thể có bảng size khác nhau. Đừng chỉ nhìn “size 37, 38…” 
            mà hãy đối chiếu chiều dài chân (cm) của bạn với bảng size mà cửa hàng cung cấp.
          </p>

          <h2>4. Lưu ý với người có chân bè hoặc ngón chân dài</h2>
          <p>
            Nếu chân bạn bè ngang hoặc ngón chân dài, có thể cân nhắc tăng nửa size hoặc một size 
            tuỳ form giày. Với các mẫu mũi nhọn, nên ưu tiên tăng size để tránh bị đau mũi chân.
          </p>

          <h2>5. Hỏi thêm tư vấn từ cửa hàng</h2>
          <p>
            Đừng ngại gửi số đo chân, hình bàn chân hoặc mẫu giày bạn đang đi vừa cho nhân viên tư vấn. 
            Những thông tin này giúp cửa hàng gợi ý size chính xác hơn.
          </p>

          <h2>6. Kinh nghiệm “xương máu” khi mua giày online</h2>
          <ul>
            <li>Không chọn size theo thói quen nếu đổi sang thương hiệu mới.</li>
            <li>Đọc kỹ feedback của khách hàng trước đó (nhất là các nhận xét về size).</li>
            <li>Ưu tiên các shop cho phép đổi size linh hoạt.</li>
          </ul>

          <h2>Kết luận</h2>
          <p>
            Chọn đúng size giày online không quá khó nếu bạn chịu khó đo chân và tham khảo bảng size cẩn thận. 
            Một đôi giày vừa vặn sẽ giúp bạn tự tin và thoải mái hơn trong mọi hoạt động hằng ngày.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-size-online.jpg',
        IsActive: true,
        CreatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      },

      // 4. 5 kiểu giày cơ bản
      {
        Title: '5 kiểu giày cơ bản mà mọi cô gái nên có trong tủ đồ',
        Content: `
          <p>
            Thay vì sở hữu quá nhiều đôi giày nhưng ít sử dụng, bạn nên xây dựng một tủ giày tinh gọn 
            với những kiểu dáng cơ bản, dễ phối đồ và không bao giờ lỗi mốt. Dưới đây là 5 kiểu giày 
            cơ bản mà mọi cô gái nên có.
          </p>

          <h2>1. Sneaker trắng</h2>
          <p>
            Sneaker trắng có thể kết hợp với hầu hết mọi outfit: từ váy hoa, quần jeans đến quần tây. 
            Đây là đôi giày “cứu cánh” trong những ngày bạn không biết nên mang gì.
          </p>

          <h2>2. Giày búp bê hoặc loafer</h2>
          <p>
            Đây là lựa chọn tối ưu những ngày bạn cần sự thoải mái tối đa nhưng vẫn muốn giữ vẻ gọn gàng. 
            Loafer da hoặc búp bê mũi tròn là hai lựa chọn dễ dùng.
          </p>

          <h2>3. Giày slingback</h2>
          <p>
            Như đã chia sẻ ở các bài trước, slingback là mẫu giày thanh lịch, dễ phối và phù hợp nhiều hoàn cảnh. 
            Một đôi slingback màu nude hoặc đen là khoản đầu tư rất đáng.
          </p>

          <h2>4. Sandal đơn giản</h2>
          <p>
            Một đôi sandal quai mảnh, màu trung tính sẽ giúp bạn thoải mái trong những ngày nắng nóng, 
            đi chơi biển hoặc dạo phố cuối tuần.
          </p>

          <h2>5. Giày cao gót basic</h2>
          <p>
            Ít nhất bạn nên có một đôi cao gót 5–7 cm, mũi nhọn hoặc mũi tròn, màu đen hoặc nude. 
            Đây là lựa chọn không thể thiếu cho các buổi họp quan trọng, sự kiện, tiệc tùng.
          </p>

          <h2>Kết luận</h2>
          <p>
            Khi đã có 5 kiểu giày cơ bản này, bạn sẽ dễ dàng xoay chuyển phong cách mà không cần sưu tập quá nhiều. 
            Từ nền tảng đó, bạn có thể bổ sung thêm các thiết kế đặc biệt hơn theo sở thích cá nhân.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-5-kieu-giay.jpg',
        IsActive: true,
        CreatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },

      // 5. Chăm sóc giày da
      {
        Title: 'Cách vệ sinh và bảo quản giày da để luôn như mới',
        Content: `
          <p>
            Giày da là item không thể thiếu trong tủ đồ của nhiều người vì vừa bền, vừa sang. 
            Tuy nhiên, nếu không chăm sóc đúng cách, giày rất dễ bị bong tróc, nứt gãy hoặc mất form. 
            Dưới đây là hướng dẫn chi tiết để bạn có thể giữ đôi giày da luôn trong trạng thái tốt nhất.
          </p>

          <h2>1. Vệ sinh giày da đúng cách</h2>
          <p>
            Trước tiên, hãy dùng khăn mềm hoặc bàn chải lông mịn để loại bỏ lớp bụi bẩn trên bề mặt. 
            Sau đó, dùng dung dịch chuyên dụng cho da (hoặc khăn ẩm vắt thật khô) lau nhẹ nhàng, tránh chà xát mạnh.
          </p>

          <h2>2. Hạn chế dùng nước trực tiếp</h2>
          <p>
            Da không “ưa” nước. Nếu giày bị ướt mưa, hãy dùng khăn khô thấm bớt nước, 
            rồi để giày khô tự nhiên ở nơi thoáng gió. Tuyệt đối không dùng máy sấy hoặc phơi dưới nắng gắt.
          </p>

          <h2>3. Dưỡng da định kỳ</h2>
          <p>
            Tương tự như da người, da giày cũng cần được “dưỡng ẩm”. 
            Bạn nên dùng kem dưỡng hoặc xi dưỡng chuyên dụng cho da giày khoảng 1–2 lần/tháng, 
            tuỳ tần suất sử dụng.
          </p>

          <h2>4. Giữ form giày bằng giấy hoặc shoe tree</h2>
          <p>
            Khi không sử dụng, hãy nhét giấy mềm hoặc sử dụng shoe tree để giữ form giày, 
            tránh bị gãy mũi hoặc nhăn da.
          </p>

          <h2>5. Bảo quản nơi khô ráo, thoáng mát</h2>
          <p>
            Đặt giày ở nơi khô ráo, tránh ẩm mốc. Có thể dùng thêm gói hút ẩm trong hộp giày 
            nếu thời tiết nồm ẩm kéo dài.
          </p>

          <h2>Kết luận</h2>
          <p>
            Với một chút thời gian chăm sóc định kỳ, đôi giày da của bạn sẽ luôn giữ được vẻ ngoài 
            như mới, bền đẹp và xứng đáng với số tiền đã bỏ ra.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-cham-soc-giay-da.jpg',
        IsActive: true,
        CreatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      },

      // 6. Phối giày theo hoàn cảnh
      {
        Title: 'Chọn giày phù hợp cho từng hoàn cảnh: đi làm, đi chơi, đi tiệc',
        Content: `
          <p>
            Một đôi giày phù hợp không chỉ giúp bạn cảm thấy thoải mái mà còn thể hiện sự tinh tế 
            trong mắt người đối diện. Mỗi hoàn cảnh khác nhau sẽ phù hợp với một kiểu giày khác nhau. 
            Hãy cùng điểm qua một vài gợi ý cơ bản.
          </p>

          <h2>1. Đi làm: thanh lịch và chuyên nghiệp</h2>
          <p>
            Môi trường công sở yêu cầu sự chỉn chu. Bạn có thể ưu tiên các mẫu giày slingback, 
            loafer hoặc cao gót gót vừa, màu sắc trung tính. Kiểu dáng nên đơn giản, hạn chế chi tiết quá cầu kỳ.
          </p>

          <h2>2. Đi chơi, dạo phố: thoải mái là ưu tiên hàng đầu</h2>
          <p>
            Khi đi chơi, bạn có thể thoải mái lựa chọn sneaker, sandal hoặc các mẫu giày bệt. 
            Miễn là bạn cảm thấy dễ chịu khi di chuyển và phong cách cá nhân được thể hiện.
          </p>

          <h2>3. Dự tiệc, sự kiện: nổi bật nhưng vẫn tinh tế</h2>
          <p>
            Các buổi tiệc là dịp để bạn diện những đôi giày đặc biệt hơn: cao gót mũi nhọn, 
            slingback đính đá, satin, hoặc màu sắc nổi bật. Hãy kết hợp với váy phù hợp để tổng thể hài hòa.
          </p>

          <h2>4. Các tình huống đặc biệt khác</h2>
          <ul>
            <li><strong>Phỏng vấn:</strong> nên chọn giày kín mũi, gót vừa, màu trung tính.</li>
            <li><strong>Gặp khách hàng quan trọng:</strong> ưu tiên giày mới, sạch, thể hiện sự tôn trọng.</li>
            <li><strong>Du lịch dài ngày:</strong> mang ít nhất một đôi sneaker và một đôi sandal thoải mái.</li>
          </ul>

          <h2>Kết luận</h2>
          <p>
            Không có một đôi giày nào phù hợp với mọi hoàn cảnh. 
            Điều quan trọng là bạn hiểu tính chất của từng hoạt động để đưa ra lựa chọn hợp lý, 
            vừa đẹp vừa thực tế.
          </p>
        `,
        Author: 'Quản Trị',
        ImageURL: '/images/blog-giay-hoan-canh.jpg',
        IsActive: true,
        CreatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      }

    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Blogs', {
      Title: [
        'Top 5 mẫu giày slingback nên có trong tủ giày của mỗi cô nàng',
        'Bật mí 7 tips phối đồ giúp đôi chân trông thon gọn hơn',
        'Hướng dẫn chọn size giày online chuẩn hơn, hạn chế bị chật hoặc rộng',
        '5 kiểu giày cơ bản mà mọi cô gái nên có trong tủ đồ',
        'Cách vệ sinh và bảo quản giày da để luôn như mới',
        'Chọn giày phù hợp cho từng hoàn cảnh: đi làm, đi chơi, đi tiệc'
      ]
    }, {});
  }
};
