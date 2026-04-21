#import <React/RCTComponent.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface YifanJustifiedTextView : UIView

@property (nonatomic, copy, nullable) NSArray<NSDictionary *> *segments;
@property (nonatomic, strong, nullable) UIColor *textColor;
@property (nonatomic, strong, nullable) UIColor *accentColor;
@property (nonatomic, strong, nullable) UIColor *tagActiveColor;
@property (nonatomic, strong, nullable) UIColor *tagActiveBackgroundColor;
@property (nonatomic, strong, nullable) UIColor *tagInactiveBackgroundColor;
@property (nonatomic, copy, nullable) NSString *fontFamily;
@property (nonatomic, assign) CGFloat fontSize;
@property (nonatomic, assign) CGFloat lineHeight;
@property (nonatomic, assign) BOOL justify;
@property (nonatomic, copy, nullable) NSString *activeTag;

@property (nonatomic, copy, nullable) RCTBubblingEventBlock onPressMention;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onPressTag;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onPressLink;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onPressText;
@property (nonatomic, copy, nullable) RCTBubblingEventBlock onContentSizeChange;

@end

NS_ASSUME_NONNULL_END
