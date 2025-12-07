'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Default auto-replies for chatbot
    await queryInterface.bulkInsert('ChatAutoReplies', [
      {
        TriggerKeywords: 'xin chào,hello,hi,chào,alo',
        Response: 'Xin chào! Tôi là trợ lý ảo của LilyShoe. Tôi có thể giúp bạn:\n- Tư vấn sản phẩm\n- Kiểm tra tình trạng đơn hàng\n- Hỗ trợ đổi/trả hàng\n- Các vấn đề khác\n\nHãy cho tôi biết bạn cần hỗ trợ gì nhé!',
        Priority: 100,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'đơn hàng,order,tracking,theo dõi,giao hàng',
        Response: 'Để kiểm tra tình trạng đơn hàng, bạn có thể:\n1. Đăng nhập vào tài khoản và vào mục "Đơn hàng của tôi"\n2. Sử dụng tính năng "Tra cứu đơn hàng" trên website với mã đơn hàng\n\nNếu bạn cần hỗ trợ thêm về đơn hàng cụ thể, vui lòng nhấn "Yêu cầu nhân viên hỗ trợ" để được kết nối với nhân viên.',
        Priority: 90,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'đổi trả,trả hàng,hoàn tiền,refund,đổi size',
        Response: 'Chính sách đổi trả của LilyShoe:\n- Đổi hàng trong vòng 7 ngày kể từ ngày nhận\n- Sản phẩm còn nguyên tem, nhãn mác\n- Chưa qua sử dụng\n\nĐể yêu cầu đổi/trả hàng, vui lòng liên hệ qua:\n📞 Hotline: 1900-xxxx\n📧 Email: support@lilyshoe.com\n\nHoặc nhấn "Yêu cầu nhân viên hỗ trợ" để được hỗ trợ trực tiếp.',
        Priority: 85,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'size,kích thước,cỡ,bảng size',
        Response: 'Bảng quy đổi size giày của LilyShoe:\n\nNữ: 35 = 22cm, 36 = 23cm, 37 = 23.5cm, 38 = 24cm, 39 = 25cm\nNam: 39 = 25cm, 40 = 25.5cm, 41 = 26cm, 42 = 27cm, 43 = 28cm, 44 = 29cm\n\n💡 Tip: Để chọn size chuẩn, hãy đo chiều dài bàn chân và so với bảng size trên.\n\nBạn cần tư vấn thêm về size? Nhấn "Yêu cầu nhân viên hỗ trợ"!',
        Priority: 80,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'thanh toán,payment,COD,VNPAY,trả tiền',
        Response: 'LilyShoe hỗ trợ các hình thức thanh toán:\n\n1️⃣ COD - Thanh toán khi nhận hàng\n2️⃣ VNPAY - Thanh toán online qua QR hoặc thẻ\n\n⚠️ Lưu ý: Đơn hàng VNPAY cần thanh toán trong 15 phút, nếu không sẽ tự động hủy.\n\nBạn gặp vấn đề khi thanh toán? Nhấn "Yêu cầu nhân viên hỗ trợ"!',
        Priority: 75,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'ship,vận chuyển,phí ship,giao hàng,bao lâu',
        Response: 'Thông tin vận chuyển của LilyShoe:\n\n🚚 Thời gian giao hàng:\n- Nội thành: 1-2 ngày\n- Ngoại thành: 3-5 ngày\n- Tỉnh khác: 5-7 ngày\n\n💰 Phí vận chuyển: Tính theo đơn vị vận chuyển (hiển thị khi checkout)\n\n🎁 Miễn phí ship cho đơn từ 500.000đ',
        Priority: 70,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'giá,price,bao nhiêu,tiền',
        Response: 'Để xem giá sản phẩm, bạn có thể:\n1. Truy cập trang sản phẩm để xem giá chi tiết\n2. Giá đã bao gồm thuế VAT\n3. Nhiều sản phẩm có khuyến mãi giảm giá\n\n💡 Bạn có thể thu thập voucher tại mục "Kho Voucher" để được giảm giá thêm!',
        Priority: 65,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'voucher,mã giảm giá,coupon,khuyến mãi',
        Response: 'Để sử dụng mã giảm giá:\n1. Truy cập mục "Kho Voucher" trên website\n2. Thu thập voucher bạn muốn\n3. Áp dụng khi checkout\n\n📌 Mỗi đơn hàng chỉ được áp dụng 1 mã giảm giá.\n📌 Kiểm tra điều kiện áp dụng của từng voucher.',
        Priority: 60,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'cảm ơn,thank,thanks,cám ơn',
        Response: 'Không có gì! LilyShoe luôn sẵn sàng hỗ trợ bạn. Nếu có thêm câu hỏi, đừng ngần ngại liên hệ nhé! 😊',
        Priority: 50,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      },
      {
        TriggerKeywords: 'bye,tạm biệt,goodbye',
        Response: 'Tạm biệt! Cảm ơn bạn đã sử dụng dịch vụ của LilyShoe. Chúc bạn một ngày tốt lành! 👋',
        Priority: 45,
        IsActive: true,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      }
    ]);

    // Default banned keywords
    await queryInterface.bulkInsert('ChatBannedKeywords', [
      { Keyword: 'đm', IsActive: true, CreatedAt: new Date() },
      { Keyword: 'vl', IsActive: true, CreatedAt: new Date() },
      { Keyword: 'wtf', IsActive: true, CreatedAt: new Date() },
      { Keyword: 'lừa đảo', IsActive: true, CreatedAt: new Date() },
      { Keyword: 'scam', IsActive: true, CreatedAt: new Date() }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ChatAutoReplies', null, {});
    await queryInterface.bulkDelete('ChatBannedKeywords', null, {});
  }
};
