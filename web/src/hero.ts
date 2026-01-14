import { heroui } from "@heroui/react";

export default heroui({
  themes: {
    "flexoki-dark": {
      extend: "dark",
      colors: {
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
          foreground: "#000000",
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
          foreground: "#000000",
        },

        // Focus ring
        focus: "#3AA99F", // cyan-400
      },
    },

    "flexoki-light": {
      extend: "light",
      colors: {
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
        },
        // Focus ring
        focus: "#24837B", // cyan-600
      },
    },
  },
});
