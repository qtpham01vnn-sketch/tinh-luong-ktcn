/**
 * BẢNG ĐƠN GIÁ VÀ QUỸ LƯƠNG TÍNH CHO TỪNG BỘ PHẬN - CÔNG TY CP GẠCH MEN PHƯƠNG NAM
 * Căn cứ Quyết định số 01/KSX-2026/PNC-QĐ ban hành ngày 01/04/2026 bởi TGĐ Đinh Khắc Trung
 * và Bảng chi tiết định biên nhân lực do Kế toán trưởng Hoàng Minh Quang & TGĐ ký duyệt.
 *
 * Mức lương chuẩn Hệ số 1 toàn nhà máy: 6,168,247 đ
 */

export interface DepartmentProductQuota {
  productCode: '30x60' | '40x80' | '50x50' | '60x60';
  productName: string;
  line: 'DC1' | 'DC2';
  monthlyQuotaM2: number;
  unitPriceVND: number;
  totalFundVND: number;
  totalHeadcount: number;
  totalCoeff: number;
  subGroups: {
    groupName: string;
    headcount: number;
    coeff: number;
    fundVND: number;
  }[];
}

export interface DepartmentTariffMaster {
  deptCode: 'VP_SX' | 'TBTM' | 'PXSX' | 'PXCD' | 'PKTCN';
  deptName: string;
  quotas: Record<string, DepartmentProductQuota>;
}

export const BASE_HS1_FACTORY = 6168247;

export const MASTER_TARIFFS_2026: Record<string, DepartmentTariffMaster> = {
  // 1. VĂN PHÒNG DÂY CHUYỀN
  VP_SX: {
    deptCode: 'VP_SX',
    deptName: 'Văn phòng Dây chuyền',
    quotas: {
      '30x60': {
        productCode: '30x60',
        productName: 'Gạch 30x60',
        line: 'DC1',
        monthlyQuotaM2: 462300,
        unitPriceVND: 60,
        totalFundVND: 27757111,
        totalHeadcount: 4,
        totalCoeff: 9.0,
        subGroups: [
          { groupName: 'Quản đốc', headcount: 1, coeff: 4.8, fundVND: 14803793 },
          { groupName: 'Thống kê / Nhân viên', headcount: 3, coeff: 4.2, fundVND: 12953319 },
        ],
      },
      '40x80': {
        productCode: '40x80',
        productName: 'Gạch 40x80',
        line: 'DC2',
        monthlyQuotaM2: 430680,
        unitPriceVND: 64,
        totalFundVND: 27757111,
        totalHeadcount: 4,
        totalCoeff: 9.0,
        subGroups: [
          { groupName: 'Quản đốc', headcount: 1, coeff: 4.8, fundVND: 14803793 },
          { groupName: 'Thống kê', headcount: 3, coeff: 4.2, fundVND: 12953319 },
        ],
      },
      '50x50': {
        productCode: '50x50',
        productName: 'Gạch 50x50',
        line: 'DC2',
        monthlyQuotaM2: 413658,
        unitPriceVND: 67,
        totalFundVND: 27757111,
        totalHeadcount: 4,
        totalCoeff: 9.0,
        subGroups: [
          { groupName: 'Quản đốc', headcount: 1, coeff: 4.8, fundVND: 14803793 },
          { groupName: 'Thống kê', headcount: 3, coeff: 4.2, fundVND: 12953319 },
        ],
      },
      '60x60': {
        productCode: '60x60',
        productName: 'Gạch 60x60',
        line: 'DC2',
        monthlyQuotaM2: 364800,
        unitPriceVND: 76,
        totalFundVND: 27757111,
        totalHeadcount: 4,
        totalCoeff: 9.0,
        subGroups: [
          { groupName: 'Quản đốc', headcount: 1, coeff: 4.8, fundVND: 14803793 },
          { groupName: 'Thống kê', headcount: 3, coeff: 4.2, fundVND: 12953319 },
        ],
      },
    },
  },

  // 2. BỘ PHẬN TẠO BỘT - TẠO MEN (TBTM)
  TBTM: {
    deptCode: 'TBTM',
    deptName: 'Bộ phận Tạo bột - Tạo men',
    quotas: {
      '30x60': {
        productCode: '30x60',
        productName: 'Gạch 30x60',
        line: 'DC1',
        monthlyQuotaM2: 462300,
        unitPriceVND: 635,
        totalFundVND: 293731921,
        totalHeadcount: 64,
        totalCoeff: 95.24,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 4, coeff: 10.85, fundVND: 33462740 },
          { groupName: 'Nghiền liệu', headcount: 18, coeff: 24.63, fundVND: 75961961 },
          { groupName: 'Sấy phun', headcount: 17, coeff: 25.03, fundVND: 77195611 },
          { groupName: 'Nghiền men', headcount: 17, coeff: 23.33, fundVND: 71952601 },
          { groupName: 'Xe xúc', headcount: 7, coeff: 10.30, fundVND: 31766472 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 3392536 },
        ],
      },
      '40x80': {
        productCode: '40x80',
        productName: 'Gạch 40x80',
        line: 'DC2',
        monthlyQuotaM2: 430680,
        unitPriceVND: 682,
        totalFundVND: 293731921,
        totalHeadcount: 64,
        totalCoeff: 95.24,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 4, coeff: 10.85, fundVND: 33462740 },
          { groupName: 'Nghiền liệu', headcount: 18, coeff: 24.63, fundVND: 75961961 },
          { groupName: 'Sấy phun', headcount: 17, coeff: 25.03, fundVND: 77195611 },
          { groupName: 'Nghiền men', headcount: 17, coeff: 23.33, fundVND: 71952601 },
          { groupName: 'Xe xúc', headcount: 7, coeff: 10.30, fundVND: 31766472 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 3392536 },
        ],
      },
      '50x50': {
        productCode: '50x50',
        productName: 'Gạch 50x50',
        line: 'DC2',
        monthlyQuotaM2: 413658,
        unitPriceVND: 710,
        totalFundVND: 293731921,
        totalHeadcount: 64,
        totalCoeff: 95.24,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 4, coeff: 10.85, fundVND: 33462740 },
          { groupName: 'Nghiền liệu', headcount: 18, coeff: 24.63, fundVND: 75961961 },
          { groupName: 'Sấy phun', headcount: 17, coeff: 25.03, fundVND: 77195611 },
          { groupName: 'Nghiền men', headcount: 17, coeff: 23.33, fundVND: 71952601 },
          { groupName: 'Xe xúc', headcount: 7, coeff: 10.30, fundVND: 31766472 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 3392536 },
        ],
      },
      '60x60': {
        productCode: '60x60',
        productName: 'Gạch 60x60',
        line: 'DC2',
        monthlyQuotaM2: 364800,
        unitPriceVND: 805, // Tháng 10 áp dụng 813 đ do điều chỉnh cơ cấu bóng/matt
        totalFundVND: 293731921,
        totalHeadcount: 64,
        totalCoeff: 95.24,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 4, coeff: 10.85, fundVND: 33462740 },
          { groupName: 'Nghiền liệu', headcount: 18, coeff: 24.63, fundVND: 75961961 },
          { groupName: 'Sấy phun', headcount: 17, coeff: 25.03, fundVND: 77195611 },
          { groupName: 'Nghiền men', headcount: 17, coeff: 23.33, fundVND: 71952601 },
          { groupName: 'Xe xúc', headcount: 7, coeff: 10.30, fundVND: 31766472 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 3392536 },
        ],
      },
    },
  },

  // 3. PHÂN XƯỞNG SẢN XUẤT (PXSX)
  PXSX: {
    deptCode: 'PXSX',
    deptName: 'Phân xưởng Sản xuất',
    quotas: {
      '30x60': {
        productCode: '30x60',
        productName: 'Gạch 30x60',
        line: 'DC1',
        monthlyQuotaM2: 462300,
        unitPriceVND: 1925, // Tháng 10 đề nghị thanh toán 1,985 đ
        totalFundVND: 890016356,
        totalHeadcount: 101,
        totalCoeff: 144.29,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 5, coeff: 13.30, fundVND: 82037685 },
          { groupName: 'Công đoạn ép - Tráng men', headcount: 25, coeff: 33.71, fundVND: 208054970 },
          { groupName: 'Công đoạn lò nung', headcount: 27, coeff: 39.03, fundVND: 240746679 },
          { groupName: 'Công đoạn PLĐG', headcount: 43, coeff: 57.15, fundVND: 352391949 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 6785072 },
        ],
      },
      '40x80': {
        productCode: '40x80',
        productName: 'Gạch 40x80',
        line: 'DC2',
        monthlyQuotaM2: 430680,
        unitPriceVND: 2345, // Tháng 10 thực chi 2,409 đ
        totalFundVND: 1009988759,
        totalHeadcount: 113,
        totalCoeff: 163.74,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 15.75, fundVND: 97149890 },
          { groupName: 'Công đoạn ép - Tráng men', headcount: 25, coeff: 33.73, fundVND: 208054970 },
          { groupName: 'Công đoạn lò nung', headcount: 30, coeff: 43.23, fundVND: 266653317 },
          { groupName: 'Công đoạn PLĐG', headcount: 36, coeff: 48.03, fundVND: 296260902 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 6785072 },
          { groupName: 'Xe nâng', headcount: 15, coeff: 21.90, fundVND: 135084609 },
        ],
      },
      '50x50': {
        productCode: '50x50',
        productName: 'Gạch 50x50',
        line: 'DC2',
        monthlyQuotaM2: 413658,
        unitPriceVND: 2442,
        totalFundVND: 1009988759,
        totalHeadcount: 113,
        totalCoeff: 163.74,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 15.75, fundVND: 97149890 },
          { groupName: 'Công đoạn ép - Tráng men', headcount: 25, coeff: 33.73, fundVND: 208054970 },
          { groupName: 'Công đoạn lò nung', headcount: 30, coeff: 43.23, fundVND: 266653317 },
          { groupName: 'Công đoạn PLĐG', headcount: 36, coeff: 48.03, fundVND: 296260902 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 6785072 },
          { groupName: 'Xe nâng', headcount: 15, coeff: 21.90, fundVND: 135084609 },
        ],
      },
      '60x60': {
        productCode: '60x60',
        productName: 'Gạch 60x60',
        line: 'DC2',
        monthlyQuotaM2: 364800,
        unitPriceVND: 2769, // Tháng 10 áp dụng 2,873 đ
        totalFundVND: 1009988759,
        totalHeadcount: 113,
        totalCoeff: 163.74,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 15.75, fundVND: 97149890 },
          { groupName: 'Công đoạn ép - Tráng men', headcount: 25, coeff: 33.73, fundVND: 208054970 },
          { groupName: 'Công đoạn lò nung', headcount: 30, coeff: 43.23, fundVND: 266653317 },
          { groupName: 'Công đoạn PLĐG', headcount: 36, coeff: 48.03, fundVND: 296260902 },
          { groupName: 'Vệ sinh công nghiệp', headcount: 1, coeff: 1.10, fundVND: 6785072 },
          { groupName: 'Xe nâng', headcount: 15, coeff: 21.90, fundVND: 135084609 },
        ],
      },
    },
  },

  // 4. PHÂN XƯỞNG CƠ ĐIỆN NĂNG LƯỢNG (PXCĐNL)
  PXCD: {
    deptCode: 'PXCD',
    deptName: 'Phân xưởng Cơ điện Năng lượng',
    quotas: {
      '30x60': {
        productCode: '30x60',
        productName: 'Gạch 30x60',
        line: 'DC1',
        monthlyQuotaM2: 462300,
        unitPriceVND: 887,
        totalFundVND: 410235750,
        totalHeadcount: 71,
        totalCoeff: 125.12,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 18.40, fundVND: 56747872 },
          { groupName: 'Trực dây chuyền 1', headcount: 5, coeff: 7.90, fundVND: 48729151 },
          { groupName: 'Trực tạo bột - tạo men', headcount: 6, coeff: 11.70, fundVND: 36084245 },
          { groupName: 'Trực ca', headcount: 18, coeff: 30.30, fundVND: 93448942 },
          { groupName: 'Phụ trợ', headcount: 6, coeff: 10.60, fundVND: 32691709 },
          { groupName: 'Sửa chữa - gia công', headcount: 4, coeff: 7.19, fundVND: 22174848 },
          { groupName: 'Than hóa khí', headcount: 21, coeff: 39.03, fundVND: 120358984 },
        ],
      },
      '40x80': {
        productCode: '40x80',
        productName: 'Gạch 40x80',
        line: 'DC2',
        monthlyQuotaM2: 430680,
        unitPriceVND: 953,
        totalFundVND: 410235750,
        totalHeadcount: 71,
        totalCoeff: 125.12,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 18.40, fundVND: 56747872 },
          { groupName: 'Trực dây chuyền 2', headcount: 5, coeff: 7.90, fundVND: 48729151 },
          { groupName: 'Trực tạo bột - tạo men', headcount: 6, coeff: 11.70, fundVND: 36084245 },
          { groupName: 'Trực ca', headcount: 18, coeff: 30.30, fundVND: 93448942 },
          { groupName: 'Phụ trợ', headcount: 6, coeff: 10.60, fundVND: 32691709 },
          { groupName: 'Sửa chữa - gia công', headcount: 4, coeff: 7.19, fundVND: 22174848 },
          { groupName: 'Than hóa khí', headcount: 21, coeff: 39.03, fundVND: 120358984 },
        ],
      },
      '50x50': {
        productCode: '50x50',
        productName: 'Gạch 50x50',
        line: 'DC2',
        monthlyQuotaM2: 413658,
        unitPriceVND: 992,
        totalFundVND: 410235750,
        totalHeadcount: 71,
        totalCoeff: 125.12,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 18.40, fundVND: 56747872 },
          { groupName: 'Trực dây chuyền 2', headcount: 5, coeff: 7.90, fundVND: 48729151 },
          { groupName: 'Trực tạo bột - tạo men', headcount: 6, coeff: 11.70, fundVND: 36084245 },
          { groupName: 'Trực ca', headcount: 18, coeff: 30.30, fundVND: 93448942 },
          { groupName: 'Phụ trợ', headcount: 6, coeff: 10.60, fundVND: 32691709 },
          { groupName: 'Sửa chữa - gia công', headcount: 4, coeff: 7.19, fundVND: 22174848 },
          { groupName: 'Than hóa khí', headcount: 21, coeff: 39.03, fundVND: 120358984 },
        ],
      },
      '60x60': {
        productCode: '60x60',
        productName: 'Gạch 60x60',
        line: 'DC2',
        monthlyQuotaM2: 364800,
        unitPriceVND: 1125,
        totalFundVND: 410235750,
        totalHeadcount: 71,
        totalCoeff: 125.12,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 6, coeff: 18.40, fundVND: 56747872 },
          { groupName: 'Trực dây chuyền 2', headcount: 5, coeff: 7.90, fundVND: 48729151 },
          { groupName: 'Trực tạo bột - tạo men', headcount: 6, coeff: 11.70, fundVND: 36084245 },
          { groupName: 'Trực ca', headcount: 18, coeff: 30.30, fundVND: 93448942 },
          { groupName: 'Phụ trợ', headcount: 6, coeff: 10.60, fundVND: 32691709 },
          { groupName: 'Sửa chữa - gia công', headcount: 4, coeff: 7.19, fundVND: 22174848 },
          { groupName: 'Than hóa khí', headcount: 21, coeff: 39.03, fundVND: 120358984 },
        ],
      },
    },
  },

  // 5. PHÒNG KỸ THUẬT - CÔNG NGHỆ (P.KTCN)
  PKTCN: {
    deptCode: 'PKTCN',
    deptName: 'Phòng Kỹ thuật - Công nghệ',
    quotas: {
      '30x60': {
        productCode: '30x60',
        productName: 'Gạch 30x60',
        line: 'DC1',
        monthlyQuotaM2: 462300,
        unitPriceVND: 303,
        totalFundVND: 139865000,
        totalHeadcount: 25,
        totalCoeff: 45.35,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 8, coeff: 21.40, fundVND: 66000243 },
          { groupName: 'Nhân viên dây chuyền 1+2', headcount: 17, coeff: 23.95, fundVND: 73864757 },
        ],
      },
      '40x80': {
        productCode: '40x80',
        productName: 'Gạch 40x80',
        line: 'DC2',
        monthlyQuotaM2: 430680,
        unitPriceVND: 325,
        totalFundVND: 139865000,
        totalHeadcount: 25,
        totalCoeff: 45.35,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 8, coeff: 21.40, fundVND: 66000243 },
          { groupName: 'Nhân viên dây chuyền 1+2', headcount: 17, coeff: 23.95, fundVND: 73864757 },
        ],
      },
      '50x50': {
        productCode: '50x50',
        productName: 'Gạch 50x50',
        line: 'DC2',
        monthlyQuotaM2: 413658,
        unitPriceVND: 338,
        totalFundVND: 139865000,
        totalHeadcount: 25,
        totalCoeff: 45.35,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 8, coeff: 21.40, fundVND: 66000243 },
          { groupName: 'Nhân viên dây chuyền 1+2', headcount: 17, coeff: 23.95, fundVND: 73864757 },
        ],
      },
      '60x60': {
        productCode: '60x60',
        productName: 'Gạch 60x60',
        line: 'DC2',
        monthlyQuotaM2: 364800,
        unitPriceVND: 383, // Tháng 10 tạm tính 387 đ cho men Matt/Bóng gộp
        totalFundVND: 139865000,
        totalHeadcount: 25,
        totalCoeff: 45.35,
        subGroups: [
          { groupName: 'Văn phòng', headcount: 8, coeff: 21.40, fundVND: 66000243 },
          { groupName: 'Nhân viên dây chuyền 1+2', headcount: 17, coeff: 23.95, fundVND: 73864757 },
        ],
      },
    },
  },
};
