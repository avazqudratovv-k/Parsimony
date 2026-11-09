import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Typography } from "@mui/material";
import { useT } from "../i18n";
import { tokens } from "../theme";

export function DemoBanner() {
  const t = useT();
  return (
    <Box
      role="note"
      sx={(theme) => {
        const c = tokens[theme.palette.mode];
        return { display: "flex", alignItems: "center", gap: 2, px: 4, py: 2, bgcolor: c.warnWash, color: c.warn, borderBottom: `1px solid ${c.line}` };
      }}
    >
      <InfoOutlinedIcon fontSize="small" />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("banner.demo")}</Typography>
    </Box>
  );
}
