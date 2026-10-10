const { createContext } = require("./common");

(async () => {
  const ctx = createContext();
  await require("./s01_title_problem")(ctx);
  await require("./s02_solution_agents")(ctx);
  await require("./s03_trust")(ctx);
  await require("./s04_admin_predictive")(ctx);
  await require("./s05_reach_arch")(ctx);
  await require("./s06_roadmap_close")(ctx);
  await ctx.pres.writeFile({ fileName: "/tmp/cp-deck/CivicPulse-Pitch.pptx" });
  console.log("written");
})().catch((e) => { console.error(e); process.exit(1); });
