/* ─────────────────────────────────────────────────────────────
 * 69码查询器 · 设计系统（深色 / 浅色双主题）
 * 深色：墨色画布 + 暖灰浮层 + 衬线标题 + 朱砂色点缀（参考 detail.design）
 * 浅色：暖纸画布 + 白卡片 + 同款朱砂强调
 * ───────────────────────────────────────────────────────────── */
import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'dark' | 'light'

export const fontSerif =
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", SimSun, serif'

export const fontSans =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

export const fontMono =
    '"SF Mono", "JetBrains Mono", "Cascadia Code", Consolas, "Roboto Mono", Menlo, monospace'

/* ── 深浅色 token ───────────────────────────────────────── */
const tokens: Record<ThemeMode, Record<string, string>> = {
    dark: {
        accent: '#E4572E',
        accentBright: '#F07A55',
        accentDeep: '#C94A24',
        accentSoft: 'rgba(228, 87, 46, 0.14)',
        text: '#EDE8E1',
        text2: '#B8B0A4',
        text3: '#8A8174',
        textFaint: '#5F584E',
        bg: '#131110',
        bgRaised: '#171513',
        bgCard: '#1E1B18',
        bgElevated: '#26221F',
        hover: 'rgba(255,255,255,0.045)',
        line: '#312D28',
        line2: '#2B2723',
        line3: '#38322B',
        line4: '#3A342D',
        success: '#6FC78F',
        warning: '#E0B341',
        error: '#E5484D',
        info: '#6FA8DC',
        gold: '#D9A441',
        boxShadow: '0 2px 8px rgba(0,0,0,0.32)',
        boxShadowSecondary: '0 16px 48px rgba(0,0,0,0.5)',
        inputBg: '#171513',
        focusRing: '0 0 0 3px rgba(228, 87, 46, 0.16)',
        errorRing: '0 0 0 3px rgba(229, 72, 77, 0.16)',
        hoverBorder: '#57503F',
        tableHeader: '#191613',
        optionActive: 'rgba(255,255,255,0.05)',
        tooltipBg: '#2C2723',
        messageBg: '#2A2521',
        alertInfoBg: 'rgba(111, 168, 220, 0.10)',
        alertInfoBd: 'rgba(111, 168, 220, 0.24)',
        alertWarnBg: 'rgba(224, 179, 65, 0.10)',
        alertWarnBd: 'rgba(224, 179, 65, 0.28)',
        alertErrBg: 'rgba(229, 72, 77, 0.10)',
        alertErrBd: 'rgba(229, 72, 77, 0.28)',
        alertOkBg: 'rgba(111, 199, 143, 0.10)',
        alertOkBd: 'rgba(111, 199, 143, 0.28)',
        tagBg: '#292520',
        btnBg: '#25211D',
        btnBd: '#3A342D',
        btnColor: '#E4DDD4',
        btnHoverBg: '#2E2924',
        btnHoverBd: '#524A40',
        btnHoverColor: '#F4EFE8',
    },
    light: {
        accent: '#D94A24',
        accentBright: '#C2410C',
        accentDeep: '#B03A12',
        accentSoft: 'rgba(217, 74, 36, 0.10)',
        text: '#201D18',
        text2: '#4D463E',
        text3: '#7D7468',
        textFaint: '#B3AA9C',
        bg: '#F5F2EC',
        bgRaised: '#FAF8F4',
        bgCard: '#FFFFFF',
        bgElevated: '#FFFFFF',
        hover: 'rgba(28,25,22,0.045)',
        line: '#E8E3DA',
        line2: '#E2DCD1',
        line3: '#DDD6CA',
        line4: '#D5CDBF',
        success: '#2E9E5B',
        warning: '#C98F1F',
        error: '#D93A41',
        info: '#2F7EC4',
        gold: '#B98A2F',
        boxShadow: '0 2px 8px rgba(28,25,22,0.08)',
        boxShadowSecondary: '0 16px 48px rgba(28,25,22,0.12)',
        inputBg: '#FFFFFF',
        focusRing: '0 0 0 3px rgba(217, 74, 36, 0.18)',
        errorRing: '0 0 0 3px rgba(217, 58, 65, 0.15)',
        hoverBorder: '#B3A896',
        tableHeader: '#F6F3ED',
        optionActive: 'rgba(28,25,22,0.045)',
        tooltipBg: '#2C2723',
        messageBg: '#FFFFFF',
        alertInfoBg: 'rgba(47, 126, 196, 0.08)',
        alertInfoBd: 'rgba(47, 126, 196, 0.25)',
        alertWarnBg: 'rgba(201, 143, 31, 0.10)',
        alertWarnBd: 'rgba(201, 143, 31, 0.30)',
        alertErrBg: 'rgba(217, 58, 65, 0.08)',
        alertErrBd: 'rgba(217, 58, 65, 0.25)',
        alertOkBg: 'rgba(46, 158, 91, 0.08)',
        alertOkBd: 'rgba(46, 158, 91, 0.25)',
        tagBg: '#F1EDE6',
        btnBg: '#FFFFFF',
        btnBd: '#D5CDBF',
        btnColor: '#4D463E',
        btnHoverBg: '#FAF8F4',
        btnHoverBd: '#B3A896',
        btnHoverColor: '#201D18',
    },
}

export function buildAntdTheme(mode: ThemeMode): ThemeConfig {
    const t = tokens[mode]
    return {
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
            colorPrimary: t.accent,
            colorInfo: t.accent,
            colorSuccess: t.success,
            colorWarning: t.warning,
            colorError: t.error,

            colorTextBase: t.text,
            colorBgBase: t.bg,
            colorBgLayout: t.bg,
            colorBgContainer: t.bgCard,
            colorBgElevated: t.bgElevated,
            colorBorder: t.line,
            colorBorderSecondary: t.line2,

            colorText: t.text,
            colorTextSecondary: t.text2,
            colorTextTertiary: t.text3,
            colorTextQuaternary: t.textFaint,

            borderRadius: 10,
            borderRadiusSM: 8,
            borderRadiusLG: 14,

            fontFamily: fontSans,
            fontSize: 14,

            controlHeight: 36,
            controlHeightLG: 44,

            boxShadow: t.boxShadow,
            boxShadowSecondary: t.boxShadowSecondary,
        },
        components: {
            Layout: {
                siderBg: t.bgRaised,
                headerBg: t.bgRaised,
                bodyBg: t.bg,
                headerHeight: 64,
                headerPadding: '0 28px',
            },
            Menu: {
                itemBg: 'transparent',
                itemColor: t.text2,
                itemHoverBg: t.hover,
                itemHoverColor: t.text,
                itemSelectedBg: t.accentSoft,
                itemSelectedColor: t.accentBright,
                itemBorderRadius: 9,
                itemMarginInline: 10,
                itemHeight: 44,
                iconSize: 16,
                subMenuItemBg: 'transparent',
            },
            Card: {
                colorBgContainer: t.bgCard,
                headerBg: 'transparent',
                colorBorderSecondary: t.line,
            },
            Table: {
                colorBgContainer: 'transparent',
                headerBg: t.tableHeader,
                headerColor: t.text3,
                headerSplitColor: t.line,
                rowHoverBg: t.hover,
                borderColor: t.line2,
                cellPaddingBlock: 13,
                cellPaddingBlockSM: 10,
                cellPaddingInlineSM: 12,
            },
            Button: {
                fontWeight: 600,
                primaryShadow: 'none',
                defaultBg: t.btnBg,
                defaultBorderColor: t.btnBd,
                defaultColor: t.btnColor,
                defaultHoverBg: t.btnHoverBg,
                defaultHoverBorderColor: t.btnHoverBd,
                defaultHoverColor: t.btnHoverColor,
                defaultActiveBg: t.btnHoverBg,
                dangerShadow: 'none',
            },
            Input: {
                colorBgContainer: t.inputBg,
                colorBgContainerDisabled: t.tableHeader,
                activeShadow: t.focusRing,
                errorActiveShadow: t.errorRing,
                hoverBorderColor: t.hoverBorder,
                colorBorder: t.line,
                paddingInline: 14,
            },
            Select: {
                colorBgContainer: t.inputBg,
                selectorBg: t.inputBg,
                optionSelectedBg: t.accentSoft,
                optionSelectedColor: t.accentBright,
                optionActiveBg: t.optionActive,
            },
            Modal: {
                contentBg: t.bgCard,
                headerBg: 'transparent',
                footerBg: 'transparent',
                titleFontSize: 17,
                titleLineHeight: 1.4,
            },
            Drawer: {
                colorBgElevated: t.bgCard,
            },
            Tabs: {
                itemColor: t.text3,
                itemHoverColor: t.text,
                itemSelectedColor: t.text,
                inkBarColor: t.accent,
                titleFontSize: 14,
                horizontalItemGutter: 28,
            },
            Tag: {
                defaultBg: t.tagBg,
                defaultColor: t.text2,
            },
            Tooltip: {
                colorBgSpotlight: t.tooltipBg,
            },
            Popover: {
                colorBgElevated: t.bgElevated,
            },
            Steps: {
                colorPrimary: t.accent,
                colorTextDescription: t.text3,
            },
            DatePicker: {
                colorBgContainer: t.inputBg,
                activeShadow: t.focusRing,
                hoverBorderColor: t.hoverBorder,
            },
            Checkbox: {
                colorBgContainer: t.inputBg,
            },
            Radio: {
                colorBgContainer: t.inputBg,
            },
            Switch: {
                colorPrimary: t.accent,
            },
            Alert: {
                colorInfoBg: t.alertInfoBg,
                colorInfoBorder: t.alertInfoBd,
                colorWarningBg: t.alertWarnBg,
                colorWarningBorder: t.alertWarnBd,
                colorErrorBg: t.alertErrBg,
                colorErrorBorder: t.alertErrBd,
                colorSuccessBg: t.alertOkBg,
                colorSuccessBorder: t.alertOkBd,
                borderRadiusLG: 12,
            },
            Message: {
                contentBg: t.messageBg,
            },
            Upload: {
                colorBgContainer: t.inputBg,
            },
            Empty: {
                colorTextDescription: t.text3,
            },
        },
    }
}

/** 默认深色（兼容旧引用） */
export const antdTheme = buildAntdTheme('dark')
