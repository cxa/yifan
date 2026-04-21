#import "YifanJustifiedTextView.h"

static NSString *const kMentionScheme = @"yifan-mention";
static NSString *const kTagScheme = @"yifan-tag";

@interface YifanJustifiedTextView () <UITextViewDelegate>
@property (nonatomic, strong) UITextView *textView;
@end

@implementation YifanJustifiedTextView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _fontSize = 15;
    _lineHeight = 24;
    _justify = YES;
    _textView = [[UITextView alloc] initWithFrame:self.bounds];
    _textView.editable = NO;
    _textView.selectable = YES; // Required for NSLinkAttributeName taps to fire
    _textView.scrollEnabled = NO;
    _textView.backgroundColor = [UIColor clearColor];
    _textView.textContainerInset = UIEdgeInsetsZero;
    _textView.textContainer.lineFragmentPadding = 0;
    _textView.delegate = self;
    _textView.dataDetectorTypes = UIDataDetectorTypeNone;
    _textView.showsVerticalScrollIndicator = NO;
    _textView.showsHorizontalScrollIndicator = NO;
    _textView.autocorrectionType = UITextAutocorrectionTypeNo;
    _textView.spellCheckingType = UITextSpellCheckingTypeNo;
    // Suppress the long-press selection gestures; selectable=YES is only
    // kept alive so that link taps fire reliably.
    for (UIGestureRecognizer *recognizer in _textView.gestureRecognizers) {
      if ([recognizer isKindOfClass:[UILongPressGestureRecognizer class]]) {
        recognizer.enabled = NO;
      }
      if ([NSStringFromClass(recognizer.class) containsString:@"PanGesture"]) {
        recognizer.enabled = NO;
      }
    }
    _textView.translatesAutoresizingMaskIntoConstraints = NO;
    [self addSubview:_textView];
    [NSLayoutConstraint activateConstraints:@[
      [_textView.topAnchor constraintEqualToAnchor:self.topAnchor],
      [_textView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
      [_textView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
      [_textView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
    ]];
    UITapGestureRecognizer *plainTap =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handlePlainTap:)];
    plainTap.cancelsTouchesInView = NO;
    [_textView addGestureRecognizer:plainTap];
  }
  return self;
}

- (void)setSegments:(NSArray<NSDictionary *> *)segments {
  _segments = [segments copy];
  [self rebuildAttributedText];
}

- (void)setTextColor:(UIColor *)textColor {
  _textColor = textColor;
  [self rebuildAttributedText];
}

- (void)setAccentColor:(UIColor *)accentColor {
  _accentColor = accentColor;
  [self rebuildAttributedText];
}

- (void)setTagActiveColor:(UIColor *)color {
  _tagActiveColor = color;
  [self rebuildAttributedText];
}

- (void)setTagActiveBackgroundColor:(UIColor *)color {
  _tagActiveBackgroundColor = color;
  [self rebuildAttributedText];
}

- (void)setTagInactiveBackgroundColor:(UIColor *)color {
  _tagInactiveBackgroundColor = color;
  [self rebuildAttributedText];
}

- (void)setFontFamily:(NSString *)fontFamily {
  _fontFamily = [fontFamily copy];
  [self rebuildAttributedText];
}

- (void)setFontSize:(CGFloat)fontSize {
  _fontSize = fontSize > 0 ? fontSize : 15;
  [self rebuildAttributedText];
}

- (void)setLineHeight:(CGFloat)lineHeight {
  _lineHeight = lineHeight > 0 ? lineHeight : 24;
  [self rebuildAttributedText];
}

- (void)setJustify:(BOOL)justify {
  _justify = justify;
  [self rebuildAttributedText];
}

- (void)setActiveTag:(NSString *)activeTag {
  _activeTag = [activeTag copy];
  [self rebuildAttributedText];
}

- (UIFont *)resolveFont {
  CGFloat size = self.fontSize > 0 ? self.fontSize : 15;
  if (self.fontFamily.length > 0) {
    UIFont *custom = [UIFont fontWithName:self.fontFamily size:size];
    if (custom) return custom;
  }
  return [UIFont systemFontOfSize:size];
}

- (void)rebuildAttributedText {
  NSArray *segments = self.segments ?: @[];
  NSMutableAttributedString *attr = [[NSMutableAttributedString alloc] init];
  UIFont *font = [self resolveFont];
  UIColor *baseColor = self.textColor ?: [UIColor blackColor];
  UIColor *accentColor = self.accentColor ?: [UIColor systemBlueColor];

  for (NSDictionary *segment in segments) {
    if (![segment isKindOfClass:[NSDictionary class]]) continue;
    NSString *type = segment[@"type"] ?: @"text";
    NSString *text = segment[@"text"] ?: @"";
    if (text.length == 0) continue;

    NSMutableDictionary<NSAttributedStringKey, id> *attrs = [NSMutableDictionary dictionary];
    attrs[NSFontAttributeName] = font;
    attrs[NSForegroundColorAttributeName] = baseColor;

    if ([type isEqualToString:@"mention"]) {
      NSString *screenName = segment[@"screenName"] ?: @"";
      attrs[NSForegroundColorAttributeName] = accentColor;
      NSString *urlString = [NSString
          stringWithFormat:@"%@://%@", kMentionScheme,
                           [screenName
                               stringByAddingPercentEncodingWithAllowedCharacters:
                                   [NSCharacterSet URLPathAllowedCharacterSet]]];
      NSURL *url = [NSURL URLWithString:urlString];
      if (url) attrs[NSLinkAttributeName] = url;
    } else if ([type isEqualToString:@"tag"]) {
      NSString *tag = segment[@"tag"] ?: @"";
      BOOL isActive = self.activeTag.length > 0 &&
                      [self.activeTag.lowercaseString
                          isEqualToString:tag.lowercaseString];
      UIColor *fg = isActive ? (self.tagActiveColor ?: [UIColor whiteColor]) : accentColor;
      UIColor *bg = isActive ? self.tagActiveBackgroundColor
                             : self.tagInactiveBackgroundColor;
      attrs[NSForegroundColorAttributeName] = fg;
      if (bg) attrs[NSBackgroundColorAttributeName] = bg;
      NSString *urlString = [NSString
          stringWithFormat:@"%@://%@", kTagScheme,
                           [tag stringByAddingPercentEncodingWithAllowedCharacters:
                                    [NSCharacterSet URLPathAllowedCharacterSet]]];
      NSURL *url = [NSURL URLWithString:urlString];
      if (url) attrs[NSLinkAttributeName] = url;
    } else if ([type isEqualToString:@"link"]) {
      NSString *href = segment[@"href"] ?: @"";
      attrs[NSForegroundColorAttributeName] = accentColor;
      attrs[NSUnderlineStyleAttributeName] = @(NSUnderlineStyleSingle);
      NSURL *url = [NSURL URLWithString:href];
      if (url) attrs[NSLinkAttributeName] = url;
    }

    [attr appendAttributedString:[[NSAttributedString alloc]
                                     initWithString:text
                                         attributes:attrs]];
  }

  if (attr.length > 0) {
    NSMutableParagraphStyle *ps = [[NSMutableParagraphStyle alloc] init];
    ps.alignment =
        self.justify ? NSTextAlignmentJustified : NSTextAlignmentNatural;
    CGFloat lh = self.lineHeight > 0 ? self.lineHeight : self.fontSize * 1.4;
    ps.minimumLineHeight = lh;
    ps.maximumLineHeight = lh;
    [attr addAttribute:NSParagraphStyleAttributeName
                 value:ps
                 range:NSMakeRange(0, attr.length)];
  }

  // Keep link tint hidden — we're colouring inline already — and remove the
  // default blue link underline that UITextView otherwise layers on top.
  self.textView.linkTextAttributes = @{
    NSUnderlineStyleAttributeName : @(NSUnderlineStyleNone),
  };
  self.textView.attributedText = attr;
  [self invalidateIntrinsicContentSize];
}

- (CGSize)intrinsicContentSize {
  CGFloat width = self.textView.frame.size.width;
  if (width <= 0) width = self.frame.size.width;
  if (width <= 0) return CGSizeMake(UIViewNoIntrinsicMetric, UIViewNoIntrinsicMetric);
  CGSize fitted = [self.textView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  return CGSizeMake(UIViewNoIntrinsicMetric, ceil(fitted.height));
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self reportContentSize];
}

- (void)reportContentSize {
  if (!self.onContentSizeChange) return;
  CGFloat width = self.bounds.size.width;
  if (width <= 0) return;
  CGSize fitted =
      [self.textView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  self.onContentSizeChange(
      @{@"width" : @(width), @"height" : @(ceil(fitted.height))});
}

- (void)handlePlainTap:(UITapGestureRecognizer *)recognizer {
  if (recognizer.state != UIGestureRecognizerStateEnded) return;
  if (!self.onPressText) return;
  CGPoint point = [recognizer locationInView:self.textView];
  // If the tap landed on an NSLinkAttribute glyph, UITextView's own handler
  // fires first and we don't forward. Only surface genuine plain-text taps.
  NSUInteger charIndex = [self.textView.layoutManager
      characterIndexForPoint:point
             inTextContainer:self.textView.textContainer
      fractionOfDistanceBetweenInsertionPoints:NULL];
  if (charIndex < self.textView.textStorage.length) {
    id link = [self.textView.textStorage attribute:NSLinkAttributeName
                                           atIndex:charIndex
                                    effectiveRange:NULL];
    if (link) return;
  }
  self.onPressText(@{});
}

#pragma mark - UITextViewDelegate

- (BOOL)textView:(UITextView *)textView
    shouldInteractWithURL:(NSURL *)URL
                  inRange:(NSRange)characterRange
              interaction:(UITextItemInteraction)interaction {
  if (interaction != UITextItemInteractionInvokeDefaultAction) return NO;
  NSString *scheme = URL.scheme;
  if ([scheme isEqualToString:kMentionScheme] && self.onPressMention) {
    self.onPressMention(@{@"screenName" : URL.host ?: @""});
    return NO;
  }
  if ([scheme isEqualToString:kTagScheme] && self.onPressTag) {
    self.onPressTag(@{@"tag" : URL.host ?: @""});
    return NO;
  }
  if (self.onPressLink) {
    self.onPressLink(@{@"href" : URL.absoluteString ?: @""});
  }
  return NO;
}

@end
