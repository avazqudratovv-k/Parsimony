import { Box } from "@mui/material";
import { useT } from "../i18n";

// The icon, drawn inline so each part can animate on its own (the same shapes as /icon.svg).
const P_PATH =
  "M422.5024 587.05408 454.53312 598.59456 451.00032 610.60608H320.28672L323.81952 598.59456L361.73824 586.112L444.17024 315.49952L412.13952 304.19456L415.67232 292.18304H550.38976Q588.30848 292.18304 611.15392 301.7216Q633.99936 311.26016 644.24448 327.74656Q654.4896 344.23296 654.4896 365.19424Q654.4896 389.21728 645.42208 409.82528Q636.35456 430.43328 618.33728 445.62432Q600.32 460.81536 573.47072 469.17632Q546.62144 477.53728 511.05792 477.53728H455.94624ZM512.47104 449.74592Q532.25472 449.74592 547.44576 443.85792Q562.6368 437.96992 572.99968 427.01824Q583.36256 416.06656 588.66176 400.87552Q593.96096 385.68448 593.96096 367.0784Q593.96096 352.00512 588.07296 341.52448Q582.18496 331.04384 569.1136 325.50912Q556.04224 319.9744 535.31648 319.9744H503.99232L464.42496 449.74592Z";
const DOT_PATH =
  "M672.86016 542.77632Q687.69792 542.77632 695.7056 551.13728Q703.71328 559.49824 703.71328 572.21632Q703.71328 583.99232 698.17856 593.7664Q692.64384 603.54048 682.98752 609.31072Q673.3312 615.08096 660.61312 615.08096Q646.01088 615.08096 637.88544 606.72Q629.76 598.35904 629.76 585.64096Q629.76 573.62944 635.29472 563.97312Q640.82944 554.3168 650.60352 548.54656Q660.3776 542.77632 672.86016 542.77632Z";
const PAPER = "245.8,158.7 778.2,158.7 778.2,814.1 733.9,865.3 689.5,814.1 645.1,865.3 600.7,814.1 556.4,865.3 512.0,814.1 467.6,865.3 423.3,814.1 378.9,865.3 334.5,814.1 290.1,865.3 245.8,814.1";

/** Big icon + wordmark for the landing page. The pieces have class names so the opening animation can target them. */
export function Hero() {
  const t = useT();
  return (
    <Box component="span" aria-label="Parsimony" role="img" sx={{ display: "inline-flex", alignItems: "center", gap: 3.5 }}>
      <svg width="48" height="48" viewBox="0 0 1024 1024" aria-hidden="true">
        <rect className="i-sq" width="1024" height="1024" rx="230" fill="#1F6F5C" />
        <g className="i-paper">
          <polygon points={PAPER} fill="#FAF8F4" />
          <rect x="315" y="703" width="394" height="8" fill="#E9E4DA" />
        </g>
        <path className="i-p" fill="#1F6F5C" d={P_PATH} />
        <path className="i-dot" fill="#1F6F5C" d={DOT_PATH} />
      </svg>
      <Box
        component="span" aria-hidden className="i-word"
        sx={{ fontFamily: '"Newsreader", serif', fontStyle: "italic", fontWeight: 500, fontSize: 38, lineHeight: 1, color: "text.primary" }}
      >
        {t("brand.name")}
        <Box component="span" sx={{ color: "primary.main" }}>.</Box>
      </Box>
    </Box>
  );
}
