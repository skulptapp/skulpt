import SwiftUI
import WatchKit

enum WatchLayoutMetrics {
  private static var screenWidth: Int {
    Int(WKInterfaceDevice.current().screenBounds.width.rounded())
  }

  static var topPadding: CGFloat {
    switch screenWidth {
    case 208, 205: return 40  // Series 10 Large, Ultra/Ultra 2
    case 198: return 36  // 45mm
    case 187: return 32  // 44mm
    case 184: return 32  // 44mm (Series 4-6/SE)
    case 176: return 32  // 41/42mm
    case 162: return 27  // 40mm
    case 156: return 24  // 38/42mm старые поколения
    default: return 32
    }
  }

  static var bottomPadding: CGFloat {
    switch screenWidth {
    case 208, 205: return 18  // Series 10 Large, Ultra/Ultra 2
    case 198, 187, 184, 176: return 14  // Series/SE Large+Small
    case 162: return 11  // 40mm
    case 156: return 10  // 38/42mm старые поколения
    default: return 14
    }
  }

  static var trackingValueFontSize: CGFloat {
    switch screenWidth {
    case 208, 205: return 44  // Series 10 Large, Ultra/Ultra 2
    case 198: return 41  // 45/46mm
    case 187: return 39  // 44mm
    case 184: return 37  // 44mm (Series 4-6/SE)
    case 176: return 36  // 41/42mm
    case 162: return 33  // 40mm
    case 156: return 31  // 38/42mm старые поколения
    default: return 38
    }
  }

  static var trackingUnitFontSize: CGFloat {
    switch screenWidth {
    case 208, 205: return 20  // Series 10 Large, Ultra/Ultra 2
    case 198: return 19  // 45/46mm
    case 187: return 18  // 44mm
    case 184: return 17  // 44mm (Series 4-6/SE)
    case 176: return 17  // 41/42mm
    case 162: return 16  // 40mm
    case 156: return 15  // 38/42mm старые поколения
    default: return 18
    }
  }

  static var trackingSeparatorBaselineOffset: CGFloat {
    switch screenWidth {
    case 208, 205: return 6.0  // Series 10 Large, Ultra/Ultra 2
    case 198: return 5.7  // 45/46mm
    case 187: return 5.4  // 44mm
    case 184: return 5.2  // 44mm (Series 4-6/SE)
    case 176: return 5.1  // 41/42mm
    case 162: return 4.8  // 40mm
    case 156: return 4.5  // 38/42mm старые поколения
    default: return 5.4
    }
  }
}
