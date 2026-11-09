import { Box } from "@mui/material";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { ThemeToggle } from "./ThemeToggle";

// Logo on the left; language, theme and (for now) a log-out menu on the right.
export function TopBar() {
  return (
    <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 4, sm: 6 }, py: 3, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Wordmark size={32} />
      <Box sx={{ flex: 1 }} />
      <LanguageSwitcher />
      <ThemeToggle />
      <AccountMenu />
    </Box>
  );
}
