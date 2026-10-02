export const catalog = [
  {id: 'gondor-swords', name: 'Gondor swordsmen', faction: 'Gondor', kind: 'Infantry', height: 13.5, file: 'gondor-swordsmen-clean.png', note: 'Clean style · eight swordsmen'},
  {id: 'gondor-horse', name: 'Gondor mounted lancers', shortName: 'Gondor lancers', faction: 'Gondor', kind: 'Mounted', height: 20, file: 'gondor-lancer-profile.png', note: 'Clean style · mirrored horse profiles'},
  {id: 'orc-axes', name: 'Orc axemen', faction: 'Orcs', kind: 'Infantry', height: 13.5, file: 'orc-axemen-clean.png', note: 'Clean style · eight axemen'},
  {id: 'orc-wargs', name: 'Orc warg riders', faction: 'Orcs', kind: 'Mounted', height: 20, file: 'orc-warg-profile.png', note: 'Clean style · mirrored warg profiles'},
  {id: 'orc-warband', name: 'Orc warband', faction: 'Orcs', kind: 'Infantry', height: 14.136, file: 'orc-warband-unit-v2.png', note: 'Clean style · eight mixed warriors'},
  {id: 'gondor-spears', name: 'Gondor spearmen', faction: 'Gondor', kind: 'Infantry', height: 13.5, file: 'gondor-spearmen-unit.png', note: 'Original textured style · eight spearmen'},
].map(art => ({...art, path: `output/imagegen/${art.file}`}));
