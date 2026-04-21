#import <React/RCTViewManager.h>

#import "YifanJustifiedTextView.h"

@interface YifanJustifiedTextManager : RCTViewManager
@end

@implementation YifanJustifiedTextManager

RCT_EXPORT_MODULE(YifanJustifiedText)

- (UIView *)view {
  return [[YifanJustifiedTextView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(segments, NSArray)
RCT_EXPORT_VIEW_PROPERTY(textColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(accentColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(tagActiveColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(tagActiveBackgroundColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(tagInactiveBackgroundColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(fontFamily, NSString)
RCT_EXPORT_VIEW_PROPERTY(fontSize, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(lineHeight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(justify, BOOL)
RCT_EXPORT_VIEW_PROPERTY(activeTag, NSString)

RCT_EXPORT_VIEW_PROPERTY(onPressMention, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPressTag, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPressLink, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPressText, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onContentSizeChange, RCTBubblingEventBlock)

@end
