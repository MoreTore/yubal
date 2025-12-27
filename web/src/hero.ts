import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    "flexoki-dark": {
      extend: "dark",
      colors: {
        // Backgrounds
        background: "#100F0F", // black

        // Content layers (surfaces)
        content1: "#1C1B1A", // base-950
        content2: "#282726", // base-900
        content3: "#343331", // base-850
        content4: "#403E3C", // base-800

        // Foreground (text)
        foreground: {
          DEFAULT: "#CECDC3", // base-200 (tx)
          50: "#100F0F",
          100: "#1C1B1A",
          200: "#282726",
          300: "#343331",
          400: "#575653", // base-700 (tx-3, faint)
          500: "#878580", // base-500 (tx-2, muted)
          600: "#B7B5AC", // base-300
          700: "#CECDC3", // base-200
          800: "#DAD8CE", // base-150
          900: "#FFFCF0", // paper (brightest)
        },

        // Default (neutral/gray scale)
        default: {
          50: "#1C1B1A", // base-950
          100: "#282726", // base-900
          200: "#343331", // base-850
          300: "#403E3C", // base-800
          400: "#575653", // base-700
          500: "#6F6E69", // base-600
          600: "#878580", // base-500
          700: "#B7B5AC", // base-300
          800: "#CECDC3", // base-200
          900: "#E6E4D9", // base-100
          DEFAULT: "#343331",
          foreground: "#CECDC3",
        },

        // Primary (cyan - links, active states)
        primary: {
          50: "#122F2C",
          100: "#143F3C",
          200: "#164F4A",
          300: "#1C6C66",
          400: "#24837B",
          500: "#2F968D",
          600: "#3AA99F", // cyan-400 (main for dark)
          700: "#5ABDAC",
          800: "#87D3C3",
          900: "#DDF1E4",
          DEFAULT: "#3AA99F",
          foreground: "#100F0F",
        },

        // Secondary (purple)
        secondary: {
          50: "#1A1623",
          100: "#261C39",
          200: "#31234E",
          300: "#3C2A62",
          400: "#4F3685",
          500: "#5E409D",
          600: "#735EB5",
          700: "#8B7EC8", // purple-400 (main for dark)
          800: "#A699D0",
          900: "#F0EAEC",
          DEFAULT: "#8B7EC8",
          foreground: "#100F0F",
        },

        // Success (green)
        success: {
          50: "#1A1E0C",
          100: "#252D09",
          200: "#313D07",
          300: "#3D4C07",
          400: "#536907",
          500: "#66800B",
          600: "#768D21",
          700: "#879A39", // green-400 (main for dark)
          800: "#A0AF54",
          900: "#EDEECF",
          DEFAULT: "#879A39",
          foreground: "#100F0F",
        },

        // Warning (orange)
        warning: {
          50: "#27180E",
          100: "#40200D",
          200: "#59290D",
          300: "#71320D",
          400: "#9D4310",
          500: "#BC5215",
          600: "#CB6120",
          700: "#DA702C", // orange-400 (main for dark)
          800: "#EC8B49",
          900: "#FFE7CE",
          DEFAULT: "#DA702C",
          foreground: "#100F0F",
        },

        // Danger (red)
        danger: {
          50: "#261312",
          100: "#3E1715",
          200: "#551B18",
          300: "#6C201C",
          400: "#942822",
          500: "#AF3029",
          600: "#C03E35",
          700: "#D14D41", // red-400 (main for dark)
          800: "#E8705F",
          900: "#FFE1D5",
          DEFAULT: "#D14D41",
          foreground: "#FFFCF0",
        },

        // Divider
        divider: "#343331", // base-850

        // Focus ring
        focus: "#3AA99F", // cyan-400
      },
      layout: {
        radius: {
          small: "4px",
          medium: "8px",
          large: "12px",
        },
        borderWidth: {
          small: "1px",
          medium: "2px",
          large: "3px",
        },
      },
    },

    "flexoki-light": {
      extend: "light",
      colors: {
        // Backgrounds
        background: "#FFFCF0", // paper

        // Content layers (surfaces)
        content1: "#F2F0E5", // base-50
        content2: "#E6E4D9", // base-100
        content3: "#DAD8CE", // base-150
        content4: "#CECDC3", // base-200

        // Foreground (text)
        foreground: {
          DEFAULT: "#100F0F", // black (tx)
          50: "#FFFCF0", // paper (lightest)
          100: "#E6E4D9",
          200: "#DAD8CE",
          300: "#CECDC3",
          400: "#878580", // base-500 (tx-3, faint)
          500: "#6F6E69", // base-600 (tx-2, muted)
          600: "#575653", // base-700
          700: "#403E3C", // base-800
          800: "#282726", // base-900
          900: "#100F0F", // black (darkest)
        },

        // Default (neutral/gray scale)
        default: {
          50: "#FFFCF0", // paper
          100: "#F2F0E5", // base-50
          200: "#E6E4D9", // base-100
          300: "#DAD8CE", // base-150
          400: "#CECDC3", // base-200
          500: "#B7B5AC", // base-300
          600: "#878580", // base-500
          700: "#6F6E69", // base-600
          800: "#575653", // base-700
          900: "#403E3C", // base-800
          DEFAULT: "#E6E4D9",
          foreground: "#100F0F",
        },

        // Primary (cyan - use 600 for light mode)
        primary: {
          50: "#DDF1E4",
          100: "#BFE8D9",
          200: "#A2DECE",
          300: "#87D3C3",
          400: "#5ABDAC",
          500: "#3AA99F",
          600: "#2F968D",
          700: "#24837B", // cyan-600 (main for light)
          800: "#1C6C66",
          900: "#122F2C",
          DEFAULT: "#24837B",
          foreground: "#FFFCF0",
        },

        // Secondary (purple - use 600 for light mode)
        secondary: {
          50: "#F0EAEC",
          100: "#E2D9E9",
          200: "#D3CAE6",
          300: "#C4B9E0",
          400: "#A699D0",
          500: "#8B7EC8",
          600: "#735EB5",
          700: "#5E409D", // purple-600 (main for light)
          800: "#4F3685",
          900: "#1A1623",
          DEFAULT: "#5E409D",
          foreground: "#FFFCF0",
        },

        // Success (green - use 600 for light mode)
        success: {
          50: "#EDEECF",
          100: "#DDE2B2",
          200: "#CDD597",
          300: "#BEC97E",
          400: "#A0AF54",
          500: "#879A39",
          600: "#768D21",
          700: "#66800B", // green-600 (main for light)
          800: "#536907",
          900: "#1A1E0C",
          DEFAULT: "#66800B",
          foreground: "#FFFCF0",
        },

        // Warning (orange - use 600 for light mode)
        warning: {
          50: "#FFE7CE",
          100: "#FED3AF",
          200: "#FCC192",
          300: "#F9AE77",
          400: "#EC8B49",
          500: "#DA702C",
          600: "#CB6120",
          700: "#BC5215", // orange-600 (main for light)
          800: "#9D4310",
          900: "#27180E",
          DEFAULT: "#BC5215",
          foreground: "#FFFCF0",
        },

        // Danger (red - use 600 for light mode)
        danger: {
          50: "#FFE1D5",
          100: "#FFCABB",
          200: "#FDB2A2",
          300: "#F89A8A",
          400: "#E8705F",
          500: "#D14D41",
          600: "#C03E35",
          700: "#AF3029", // red-600 (main for light)
          800: "#942822",
          900: "#261312",
          DEFAULT: "#AF3029",
          foreground: "#FFFCF0",
        },

        // Divider
        divider: "#DAD8CE", // base-150

        // Focus ring
        focus: "#24837B", // cyan-600
      },
      layout: {
        radius: {
          small: "4px",
          medium: "8px",
          large: "12px",
        },
        borderWidth: {
          small: "1px",
          medium: "2px",
          large: "3px",
        },
      },
    },
  },
});
