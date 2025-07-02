import React, { createContext, useState, useEffect, ReactNode } from "react";

export const ThemeContext = createContext<{
  dark: boolean;
  toggle: () => void;
}>({
  dark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <ThemeContext.Provider
      value={{
        dark,
        toggle: () => setDark((d) => !d),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
