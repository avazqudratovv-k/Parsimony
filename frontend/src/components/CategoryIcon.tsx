import { Box } from "@mui/material";
import { catTint } from "../theme";
import { Icon, isCategoryIcon } from "./Icon";

/** Category glyph on a quiet tile (40px), or bare at a small size inside the chart. */
export function CategoryIcon({ category, tile = true, size = 20 }: { category: string; tile?: boolean; size?: number }) {
  const name = isCategoryIcon(category) ? category : "other";
  if (!tile) return <Icon name={name} size={size} />;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 40, height: 40, borderRadius: 3, flexShrink: 0, display: "grid", placeItems: "center",
        bgcolor: catTint(theme.palette.mode, name).bg, color: catTint(theme.palette.mode, name).fg,
      })}
    >
      <Icon name={name} />
    </Box>
  );
}
