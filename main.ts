enum StatusBarFlag {
    None = 0,
    SmoothTransition = 1 << 0, // if set, update bar over time; otherwise update bar immediately
    LabelAtEnd = 1 << 1, // if set, and label exists, draw label at bottom or right side
    ConstrainAssignedValue = 1 << 2, // if set, constrain values stored in status bar between 0 and max
    PositionAtEnd = 1 << 3, // if set and bar is attached to a sprite, position on right or bottom (instead of top or left)
}

namespace SpriteKind {
    export const StatusBar = SpriteKind.create();
}

// TODO: option to show both target and display value, option to freeze at display value;
// allow for dark souls / fighting style game animations

// TODO: [on {status} zero] event handler

// TODO: allow timing fn for transition between prev and curr value, instead of just 50ms

// TODO: angled bars?  /::::::::::/ instead of |::::::::::|

namespace ui.statusbar {
    // TODO: store array of the managed sprites in scene using this key as well
    const STATUS_BAR_DATA_KEY = "STATUS_BAR_DATA_KEY";

    class StatusBar {
        borderWidth: number;
        // if not set, use offColor
        borderColor: number;
        labelColor: number;

        protected flags: number;
        protected _label: string;
        protected _image: Image;

        spriteToFollow: Sprite;
        followPadding: number;

        protected font: image.Font;
        // TODO: 'rounded border' / border-radius option? just 1px or 2px

        // hold state
        protected displayValue: number;
        protected target: number;

        constructor(
            protected barWidth: number,
            protected barHeight: number,
            public onColor: number,
            public offColor: number,
            protected _max: number
        ) {
            this.borderWidth = 0;
            this.borderColor = undefined;
            this.flags = StatusBarFlag.SmoothTransition;
            this._label = undefined;
            this.labelColor = 0x1;
            this.font = image.font5;

            this.displayValue = _max;
            this.target = _max;
            this.rebuildImage();
        }

        positionNextTo(status: Sprite, target: Sprite) {
            const positionAtEnd = !!(this.flags & StatusBarFlag.PositionAtEnd);
            const padding = this.followPadding;

            if (this.isVerticalBar()) {
                status.y = target.y;
                if (positionAtEnd) {
                    status.left = target.right + padding;
                } else {
                    status.right = target.left - padding;
                }
            } else {
                status.x = target.x;
                if (positionAtEnd) {
                    status.top = target.bottom + padding;
                } else {
                    status.bottom = target.top - padding;
                }
            }
        }

        get label() {
            return this._label;
        }
        
        set label(v: string) {
            this._label = v;
            this.rebuildImage();
        }

        get max() {
            return this._max;
        }

        set max(v: number) {
            this._max = v;
            this.updateState();
        }

        get current() {
            return this.target;
        }

        set current(v: number) {
            const isDifferent = this.target != v;
            this.target = v;
            if (!(this.flags & StatusBarFlag.SmoothTransition)) {
                this.displayValue = v;
            }
            this.updateState();
        }

        setFlag(flag: StatusBarFlag, on: boolean) {
            if (on)
                this.flags |= flag
            else
                this.flags = ~(~this.flags | flag);
        }

        get image() {
            return this._image;
        }

        set image(v: Image) {
            // ignore, readonly ref outside this class
        }

        protected isVerticalBar() {
            return this.barHeight > this.barWidth;
        }

        protected isSmoothTransition() {
            return this.flags & StatusBarFlag.SmoothTransition;
        }

        protected rebuildImage() {
            let width = this.barWidth;
            let height = this.barHeight;

            if (this.label) {
                const labelWidth = this.font.charWidth * this.label.length;
                if (this.isVerticalBar()) {
                    width = Math.max(width, labelWidth);
                    height += this.font.charHeight + 1;
                } else {
                    width += labelWidth;
                    height = Math.max(height, this.font.charHeight);
                }
            }

            if (!this.image || width !== this.image.width || height !== this.image.height) {
                const newImg = image.create(width, height);
                this._image = newImg;
            }

            this.updateDisplay();
        }

        private lastUpdate = game.currentScene().millis();
        private throttleAmount = 100; 
        updateState() {
            const { target, displayValue } = this;
            if (this.flags & StatusBarFlag.ConstrainAssignedValue) {
                this.target = Math.constrain(target, 0, this.max);
                this.displayValue = Math.constrain(displayValue, 0, this.max);
            }

            const currTime = game.currentScene().millis();
            if (Math.abs(this.lastUpdate - currTime) < this.throttleAmount)
                return;

            if (this.target > this.displayValue) {
                this.displayValue = Math.min(displayValue + 1, this.target);
                this.lastUpdate = currTime;
            } else if (this.target < this.displayValue) {
                this.displayValue = Math.max(displayValue - 1, this.target);
                this.lastUpdate = currTime;
            }
            
            if (displayValue !== this.displayValue) {
                this.updateDisplay();
            }
        }

        updateDisplay() {
            this.image.fill(0x0);

            const percent = Math.constrain(
                this.displayValue / this._max,
                0,
                1.0
            );

            const fillWidth = this.barWidth - 2 * this.borderWidth;
            const fillHeight = this.barHeight - 2 * this.borderWidth;
            const barIsVertical = this.isVerticalBar();
            const borderColor = util.isNullOrUndefined(this.borderColor) ?
                    this.offColor : this.borderColor;
    
            let barLeft = 0;
            let barTop = 0;
            
            if (this.label) {
                const textWidth = this.font.charWidth * this.label.length;
                const textHeight = this.font.charHeight;
                const labelEnd = this.flags & StatusBarFlag.LabelAtEnd;

                let textX = 0;
                let textY = 0;
                if (barIsVertical) {
                    if (labelEnd) {
                        textY = this.barHeight + 1;
                    } else {
                        barTop += textHeight + 1;
                    }
                    if (this.barWidth > textWidth) {
                        textX = (this.barWidth - textWidth) >> 1;
                    } else if (this.barWidth < textWidth) {
                        barLeft = (textWidth - this.barWidth) >> 1;
                    }
                } else {
                    if (labelEnd) {
                        textX = this.barWidth + 1;
                    } else {
                        barLeft += textWidth;
                    }
                    if (this.barHeight > textHeight) {
                        textY = (this.barHeight - textHeight) >> 1;
                    } else if (this.barHeight < textHeight) {
                        barTop = (textHeight - this.barHeight) >> 1;
                    }
                }

                this.image.print(
                    this.label,
                    textX,
                    textY,
                    this.labelColor,
                    this.font
                );
            }

            this.image.fillRect(
                barLeft,
                barTop,
                this.barWidth,
                this.barHeight,
                borderColor
            );

            this.image.fillRect(
                barLeft + this.borderWidth,
                barTop + this.borderWidth,
                fillWidth,
                fillHeight,
                this.offColor
            );

            if (percent > 0) {
                this.image.fillRect(
                    barLeft + this.borderWidth,
                    barTop + this.borderWidth,
                    barIsVertical ? fillWidth : Math.round(fillWidth * percent),
                    barIsVertical ? Math.round(fillHeight * percent) : fillHeight,
                    this.onColor
                );
            }
        }
    }

    export function createSprite(
        width: number,
        height: number,
        onColor: number,
        offColor: number,
        max: number
    ) {
        const sb = new StatusBar(width, height, onColor, offColor, max);
        const output = sprites.create(sb.image, SpriteKind.StatusBar);

        output.setFlag(SpriteFlag.RelativeToCamera, true);
        output.setFlag(SpriteFlag.Ghost, true);
        output.data[STATUS_BAR_DATA_KEY] = sb;
        output.z = scene.HUD_Z - 5;

        init(output);

        return output;
    }

    function init(s: Sprite) {
        let managedSprites = getManagedSprites();
        if (!managedSprites) {
            game.currentScene().data[STATUS_BAR_DATA_KEY] = managedSprites = [] as Sprite[];
            game.eventContext().registerFrameHandler(scene.UPDATE_PRIORITY + 5, () => {
                const managed = getManagedSprites();
                for (let i = managed.length - 1; i >= 0; --i) {
                    const spr = managed[i];
                    if (spr.flags & sprites.Flag.Destroyed) {
                        managed.removeAt(i);
                        continue;
                    }
                    const sb = getStatusBar(spr);
                    if (sb) {
                        sb.updateState();

                        const { spriteToFollow } = sb;
                        if (spriteToFollow) {
                            const toFollowIsRelativeToCamera = !!(spriteToFollow.flags & SpriteFlag.RelativeToCamera);
                            if (!!(spr.flags & SpriteFlag.RelativeToCamera) != toFollowIsRelativeToCamera) {
                                spr.setFlag(SpriteFlag.RelativeToCamera, toFollowIsRelativeToCamera);
                            }

                            sb.positionNextTo(spr, spriteToFollow);
                        }
                    }
                }
            });
        }
        
        managedSprites.push(s);
    }

    export function setFlag(sprite: Sprite, flag: StatusBarFlag, on: boolean) {
        applyChange(sprite, sb => {
            sb.setFlag(flag, on);
        });
    }

    export function setMax(sprite: Sprite, max: number) {
        applyChange(sprite, sb => {
            sb.max = max;
        });
    }

    export function setCurrent(sprite: Sprite, current: number) {
        applyChange(sprite, sb => {
            sb.current = current;
        });
    }

    export function setLabel(sprite: Sprite, label: string, color?: number) {
        applyChange(sprite, sb => {
            if (color)
                sb.labelColor = color;
            sb.label = label;
        });
    }

    export function setBarBorder(sprite: Sprite, borderWidth: number, color: number) {
        applyChange(sprite, sb => {
            sb.borderColor = color;
            sb.borderWidth = borderWidth;
        });
    }

    // passes back any return from action for getters / etc
    function applyChange<T>(sprite: Sprite, action: (sb: StatusBar) => T): T {
        const sb = getStatusBar(sprite);

        if (sb) {
            const output = action(sb);
            sb.updateDisplay();
            sprite.setImage(sb.image);
            return output;
        }

        return undefined;
    }

    function getStatusBar(sprite: Sprite) {
        return sprite.data[STATUS_BAR_DATA_KEY] as StatusBar;
    }

    function getManagedSprites() {
        return game.currentScene().data[STATUS_BAR_DATA_KEY] as Sprite[];
    }

    export function setStatusBarForSprite(status: Sprite, toFollow: Sprite, padding = 0) {
        applyChange(status, sb => {
            // reset this to the default value;
            // this will be changed with the follow logic to match toFollow,
            // but if this is being reassigned it should handle that gracefully
            status.setFlag(SpriteFlag.RelativeToCamera, true);
            sb.spriteToFollow = toFollow;
            sb.followPadding = padding;
        });
    }

    namespace util {
        export function isNullOrUndefined(v: any): v is null | undefined {
            return v === undefined || v === null;
        }
    }
}