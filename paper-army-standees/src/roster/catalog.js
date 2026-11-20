// Profile and cost data: existing force builder, checked 2026-10-25. See docs/profile-sources.md.
export const catalog = {
  "profiles": [
    {
      "type": "Warriors",
      "name": "Heavy Infantry",
      "points": 21,
      "combatDice": 12,
      "shootingDice": 0,
      "armour": 3,
      "stamina": 4,
      "traitsLimit": 5,
      "options": [
        {
          "id": 1,
          "name": "Reduce Armour to 2",
          "points": -5,
          "modifiers": {
            "armour": -1
          }
        },
        {
          "id": 2,
          "name": "Increase Armour to 4",
          "points": 5,
          "modifiers": {
            "armour": 1
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Big",
            "discards": [
              "Towering"
            ]
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Brittle"
          },
          "points": -1
        },
        {
          "trait": {
            "name": "Brutal"
          },
          "points": 16
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Fearsome"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Pikes"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Steadfast"
          },
          "points": 1
        }
      ]
    },
    {
      "type": "Warriors",
      "name": "Heavy Infantry with Missiles",
      "points": 21,
      "combatDice": 10,
      "shootingDice": 5,
      "armour": 3,
      "stamina": 4,
      "traitsLimit": 5,
      "options": [
        {
          "id": 1,
          "name": "Reduce Armour to 2",
          "points": -5,
          "modifiers": {
            "armour": -1
          }
        },
        {
          "id": 2,
          "name": "Increase Armour to 4",
          "points": 5,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Short Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 4,
          "name": "Exchange Javelin for Bow",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BW",
              "name": "Bow / Mounted Elf Bow",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        },
        {
          "id": 5,
          "name": "Exchange Javelin for Elf Bow/ Long Bow/ Crossbow:",
          "points": 3,
          "modifiers": {
            "missileType": {
              "id": "EB",
              "name": "Elf Bow / Crossbow / Longbow",
              "heroPointCost": [
                5,
                6,
                7,
                8
              ],
              "range": 4
            }
          }
        }
      ],
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Big",
            "discards": [
              "Towering"
            ]
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Brittle"
          },
          "points": -1
        },
        {
          "trait": {
            "name": "Brutal"
          },
          "points": 14
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Fearsome"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Pikes"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Steadfast"
          },
          "points": 1
        }
      ]
    },
    {
      "type": "Warriors",
      "name": "Formed Archers",
      "points": 21,
      "combatDice": 8,
      "shootingDice": 8,
      "armour": 2,
      "stamina": 4,
      "traitsLimit": 5,
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 3",
          "points": 5,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Exchange Bow for Short Bow",
          "points": -1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Bow for Elf Bow/ Long Bow/ Crossbow:",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "EB",
              "name": "Elf Bow / Crossbow / Longbow",
              "heroPointCost": [
                5,
                6,
                7,
                8
              ],
              "range": 4
            }
          }
        }
      ],
      "missileType": {
        "id": "BW",
        "name": "Bow / Mounted Elf Bow",
        "heroPointCost": [
          4,
          5,
          6,
          7
        ],
        "range": 3
      },
      "availableTraits": [
        {
          "trait": {
            "name": "Brittle"
          },
          "points": -1
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Steadfast"
          },
          "points": 1
        }
      ]
    },
    {
      "type": "Warriors",
      "name": "Hordes",
      "points": 12,
      "combatDice": 8,
      "shootingDice": 0,
      "armour": 2,
      "stamina": 4,
      "traitsLimit": 5,
      "options": [],
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Brittle"
          },
          "points": -1
        },
        {
          "trait": {
            "name": "Fearsome"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        }
      ]
    },
    {
      "type": "Skirmishers",
      "name": "Shooters",
      "points": 10,
      "combatDice": 6,
      "shootingDice": 6,
      "armour": 2,
      "armourWhenShot": 3,
      "stamina": 2,
      "traitsLimit": 5,
      "builtInTraits": [
        {
          "name": "Agile"
        },
        {
          "name": "Evade"
        }
      ],
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "options": [
        {
          "id": 1,
          "name": "Remove Javelin and reduce Shooting Dice to 0. No other missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -6,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 2,
          "name": "Exchange Javelin for Short Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Bow or Sling",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BS",
              "name": "Bow or Sling",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        },
        {
          "id": 4,
          "name": "Exchange Javelin for Elf Bow/ Long Bow/ Crossbow",
          "points": 3,
          "modifiers": {
            "missileType": {
              "id": "EB",
              "name": "Elf Bow / Crossbow / Longbow",
              "heroPointCost": [
                5,
                6,
                7,
                8
              ],
              "range": 4
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Flying"
          },
          "points": 10
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        }
      ]
    },
    {
      "type": "Skirmishers",
      "name": "Light Infantry",
      "points": 14,
      "combatDice": 8,
      "shootingDice": 4,
      "armour": 3,
      "stamina": 2,
      "traitsLimit": 5,
      "builtInTraits": [
        {
          "name": "Agile"
        },
        {
          "name": "Evade"
        }
      ],
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "options": [
        {
          "id": 1,
          "name": "Remove Javelin and reduce Shooting Dice to 0. No other missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -4,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 2,
          "name": "Exchange Javelin for Short Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Bow or Sling",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BW",
              "name": "Bow / Mounted Elf Bow",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        },
        {
          "id": 4,
          "name": "Exchange Javelin for Elf Bow/ Long Bow/ Crossbow",
          "points": 3,
          "modifiers": {
            "missileType": {
              "id": "EB",
              "name": "Elf Bow / Crossbow / Longbow",
              "heroPointCost": [
                5,
                6,
                7,
                8
              ],
              "range": 4
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Flying"
          },
          "points": 10
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        }
      ]
    },
    {
      "type": "Heavy Riders",
      "name": "Knights",
      "points": 26,
      "combatDice": 10,
      "shootingDice": 0,
      "armour": 4,
      "stamina": 3,
      "traitsLimit": 5,
      "options": [],
      "builtInTraits": [
        {
          "name": "Counter Charge"
        },
        {
          "name": "Disengage"
        },
        {
          "name": "Fearsome"
        },
        {
          "name": "Thunderous Charge"
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        }
      ]
    },
    {
      "type": "Heavy Riders",
      "name": "Medium Cavalry",
      "points": 20,
      "combatDice": 10,
      "shootingDice": 5,
      "armour": 3,
      "stamina": 3,
      "traitsLimit": 5,
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "builtInTraits": [
        {
          "name": "Counter Charge"
        },
        {
          "name": "Disengage"
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Remove Javelin and reduce Shooting Dice to 0. No other missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -5,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 2,
          "name": "Exchange Javelin for Mounted Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Mounted Elf Bow",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BW",
              "name": "Bow / Mounted Elf Bow",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Fearsome"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        }
      ]
    },
    {
      "type": "Light Riders",
      "name": "Scouts",
      "points": 17,
      "combatDice": 6,
      "shootingDice": 6,
      "armour": 3,
      "stamina": 2,
      "traitsLimit": 5,
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "builtInTraits": [
        {
          "name": "Counter Charge"
        },
        {
          "name": "Disengage"
        },
        {
          "name": "Evade"
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Reduce Armour to 2",
          "points": -3,
          "modifiers": {
            "armour": -1
          }
        },
        {
          "id": 2,
          "name": "Remove Javelin and reduce Shooting Dice to 0. No other missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -6,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Mounted Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 4,
          "name": "Exchange Javelin for Mounted Elf Bow",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BW",
              "name": "Bow / Mounted Elf Bow",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Flying"
          },
          "points": 10
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        }
      ]
    },
    {
      "type": "Light Riders",
      "name": "Noble Riders & Light Chariots",
      "points": 18,
      "combatDice": 8,
      "shootingDice": 4,
      "armour": 3,
      "stamina": 2,
      "traitsLimit": 5,
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "builtInTraits": [
        {
          "name": "Counter Charge"
        },
        {
          "name": "Disengage"
        },
        {
          "name": "Evade"
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 4",
          "points": 3,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Remove Javelin and reduce Shooting Dice to 0. No other missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -4,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelin for Mounted Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 4,
          "name": "Exchange Javelin for Mounted Elf Bow",
          "points": 2,
          "modifiers": {
            "missileType": {
              "id": "BW",
              "name": "Bow / Mounted Elf Bow",
              "heroPointCost": [
                4,
                5,
                6,
                7
              ],
              "range": 3
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Drilled"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Fearsome"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Flying"
          },
          "points": 10
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Impetuous"
          },
          "points": 0
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 1
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Replacements"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Spears as Tribute"
          },
          "points": 3
        }
      ]
    },
    {
      "type": "Monstrosities",
      "name": "Giant",
      "points": 42,
      "combatDice": 10,
      "shootingDice": 5,
      "armour": 4,
      "stamina": 3,
      "traitsLimit": 10,
      "missileType": {
        "id": "BD",
        "name": "Boulders",
        "heroPointCost": [],
        "range": 3
      },
      "builtInTraits": [
        {
          "name": "Aloof"
        },
        {
          "name": "Brutal"
        },
        {
          "name": "Fearsome"
        },
        {
          "name": "Impetuous"
        },
        {
          "name": "Steadfast"
        },
        {
          "name": "Towering",
          "discards": [
            "Big"
          ]
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 5",
          "points": 8,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Remove Boulders and reduce Shooting Dice to 0 but increase Combat Dice to 12",
          "points": 0,
          "modifiers": {
            "shootingDice": -5,
            "combatDice": 2,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 4
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        }
      ]
    },
    {
      "type": "Monstrosities",
      "name": "Elephants & War Mammoths",
      "points": 40,
      "combatDice": 10,
      "shootingDice": 5,
      "armour": 4,
      "stamina": 3,
      "traitsLimit": 10,
      "missileType": {
        "id": "JV",
        "name": "Javelins",
        "heroPointCost": [
          2,
          3,
          4,
          5
        ],
        "range": 1
      },
      "builtInTraits": [
        {
          "name": "Aloof"
        },
        {
          "name": "Brutal"
        },
        {
          "name": "Counter Charge"
        },
        {
          "name": "Fearsome"
        },
        {
          "name": "Impetuous"
        },
        {
          "name": "Stampede"
        },
        {
          "name": "Steadfast"
        },
        {
          "name": "Towering",
          "discards": [
            "Big"
          ]
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 5",
          "points": 8,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Remove Javelins and reduce Shooting Dice to 0. No further missiles can be taken",
          "points": -2,
          "modifiers": {
            "shootingDice": -5,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            }
          }
        },
        {
          "id": 3,
          "name": "Exchange Javelins for Mounted Bow",
          "points": 1,
          "modifiers": {
            "missileType": {
              "id": "SB",
              "name": "Short Bow / Mounted Bow",
              "heroPointCost": [
                3,
                4,
                5,
                6
              ],
              "range": 2
            }
          }
        },
        {
          "id": 4,
          "name": "Reduce size from Towering to Big",
          "points": -2,
          "modifiers": {
            "discards": [
              "Towering"
            ],
            "adds": [
              "Big"
            ]
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Hel’s Breath"
          },
          "points": 2
        },
        {
          "trait": {
            "name": "Marksman",
            "pointCost": [
              2,
              2,
              3,
              3
            ],
            "isPointCostBasedOnMissileRange": true
          }
        },
        {
          "trait": {
            "name": "Relentless"
          },
          "points": 4
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        }
      ]
    },
    {
      "type": "Monstrosities",
      "name": "Dragon",
      "points": 55,
      "combatDice": 10,
      "shootingDice": 10,
      "armour": 4,
      "stamina": 3,
      "traitsLimit": 10,
      "missileType": {
        "id": "DB",
        "name": "Dragon's Breath",
        "heroPointCost": [],
        "range": 3
      },
      "builtInTraits": [
        {
          "name": "Aloof"
        },
        {
          "name": "Blast"
        },
        {
          "name": "Brutal"
        },
        {
          "name": "Fearsome"
        },
        {
          "name": "Hel’s Breath"
        },
        {
          "name": "Impetuous"
        },
        {
          "name": "Steadfast"
        },
        {
          "name": "Towering",
          "discards": [
            "Big"
          ]
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 5",
          "points": 8,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Remove Dragon's Breath and reduce Shooting Dice to 0 and remove Blast and Hel's Breath Traits",
          "points": -10,
          "modifiers": {
            "shootingDice": -10,
            "missileType": {
              "id": "NO",
              "name": "None",
              "heroPointCost": [
                0,
                0,
                0,
                0
              ],
              "range": 0
            },
            "discards": [
              "Blast",
              "Hel’s Breath"
            ]
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Amphibious"
          },
          "points": 3
        },
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Flying"
          },
          "points": 15
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        }
      ]
    },
    {
      "type": "Monstrosities",
      "name": "Flying Beast",
      "points": 30,
      "combatDice": 10,
      "shootingDice": 0,
      "armour": 3,
      "stamina": 2,
      "traitsLimit": 10,
      "builtInTraits": [
        {
          "name": "Aloof"
        },
        {
          "name": "Big",
          "discards": [
            "Towering"
          ]
        },
        {
          "name": "Fearsome"
        },
        {
          "name": "Flying"
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 4",
          "points": 8,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Increase Stamina to 3",
          "points": 8,
          "modifiers": {
            "stamina": 1
          }
        }
      ],
      "availableTraits": [
        {
          "trait": {
            "name": "Aura of Dread"
          },
          "points": 12
        },
        {
          "trait": {
            "name": "Brutal"
          },
          "points": 14
        },
        {
          "trait": {
            "name": "Reluctant"
          },
          "points": -2
        },
        {
          "trait": {
            "name": "Towering",
            "discards": [
              "Big"
            ]
          },
          "points": 2
        }
      ]
    },
    {
      "type": "Monstrosities",
      "name": "Artillery",
      "points": 20,
      "combatDice": 6,
      "shootingDice": 6,
      "armour": 3,
      "stamina": 2,
      "traitsLimit": 10,
      "missileType": {
        "id": "LA",
        "name": "Light Artillery",
        "heroPointCost": [],
        "range": 4
      },
      "builtInTraits": [
        {
          "name": "Aloof"
        },
        {
          "name": "Blast"
        },
        {
          "name": "Fixed"
        },
        {
          "name": "Hel’s Breath"
        },
        {
          "name": "Reluctant"
        },
        {
          "name": "Slow"
        }
      ],
      "options": [
        {
          "id": 1,
          "name": "Increase Armour to 4",
          "points": 2,
          "modifiers": {
            "armour": 1
          }
        },
        {
          "id": 2,
          "name": "Exchange Light Artillery for Heavy Artillery and increase Combat and Shooting Dice to 8",
          "points": 8,
          "modifiers": {
            "combatDice": 2,
            "shootingDice": 2,
            "missileType": {
              "id": "HA",
              "name": "Heavy Artillery",
              "heroPointCost": [],
              "range": 5
            }
          }
        }
      ],
      "availableTraits": []
    }
  ],
  "heroTraits": [
    {
      "name": "Amphibious",
      "isRareAndPowerful": false,
      "pointCost": 2
    },
    {
      "name": "Army Commander",
      "isRareAndPowerful": false,
      "pointCost": 0,
      "limit": 1,
      "modifiers": {
        "reputation": 1
      }
    },
    {
      "name": "Artillerist",
      "isRareAndPowerful": false,
      "pointCost": [
        2,
        4,
        6,
        8
      ]
    },
    {
      "name": "Aura of Dread",
      "isRareAndPowerful": false,
      "pointCost": 12
    },
    {
      "name": "Battle Smiter",
      "isRareAndPowerful": false,
      "pointCost": [
        2,
        4,
        8,
        10
      ]
    },
    {
      "name": "Beast Master",
      "isRareAndPowerful": false,
      "pointCost": 5
    },
    {
      "name": "Big",
      "isRareAndPowerful": false,
      "pointCost": 0
    },
    {
      "name": "Brutal",
      "isRareAndPowerful": false,
      "pointCost": [
        6,
        10,
        14,
        18
      ]
    },
    {
      "name": "Divine Intervention",
      "isRareAndPowerful": true,
      "pointCost": 5
    },
    {
      "name": "Fated",
      "isRareAndPowerful": false,
      "pointCost": 0
    },
    {
      "name": "Favour of the Gods",
      "isRareAndPowerful": true,
      "pointCost": 3
    },
    {
      "name": "Fearsome",
      "isRareAndPowerful": false,
      "pointCost": 3
    },
    {
      "name": "Flying",
      "isRareAndPowerful": false,
      "pointCost": [
        5,
        8,
        11,
        14
      ]
    },
    {
      "name": "Hel’s Breath",
      "isRareAndPowerful": true,
      "pointCost": 2
    },
    {
      "name": "Hold Fast",
      "isRareAndPowerful": false,
      "pointCost": 4
    },
    {
      "name": "Inspiring",
      "isRareAndPowerful": false,
      "pointCost": 6
    },
    {
      "name": "I Foretell Mighty Deeds",
      "isRareAndPowerful": true,
      "pointCost": 3
    },
    {
      "name": "Legendary Missile",
      "isRareAndPowerful": true,
      "pointCost": [
        2,
        4,
        6,
        8
      ],
      "isPointCostBasedOnMissileRange": true
    },
    {
      "name": "Legendary Weapon",
      "isRareAndPowerful": true,
      "pointCost": 8
    },
    {
      "name": "Marksman",
      "isRareAndPowerful": false,
      "pointCost": [
        2,
        2,
        3,
        3
      ],
      "isPointCostBasedOnMissileRange": true
    },
    {
      "name": "Mounted",
      "isRareAndPowerful": false,
      "pointCost": 2
    },
    {
      "name": "Non-Combattant",
      "isRareAndPowerful": false,
      "pointCost": 0
    },
    {
      "name": "Omens",
      "isRareAndPowerful": false,
      "pointCost": 2
    },
    {
      "name": "On My Command, Unleash Hell",
      "isRareAndPowerful": false,
      "pointCost": 4
    },
    {
      "name": "Proud",
      "isRareAndPowerful": false,
      "pointCost": 0
    },
    {
      "name": "Sorcery",
      "isRareAndPowerful": true,
      "pointCost": 0
    },
    {
      "name": "Today We Fight to Win",
      "isRareAndPowerful": false,
      "pointCost": 4
    },
    {
      "name": "With Me",
      "isRareAndPowerful": false,
      "pointCost": 4
    }
  ],
  "missiles": [
    {
      "id": "NO",
      "name": "None",
      "heroPointCost": [
        0,
        0,
        0,
        0
      ],
      "range": 0
    },
    {
      "id": "JV",
      "name": "Javelins",
      "heroPointCost": [
        2,
        3,
        4,
        5
      ],
      "range": 1
    },
    {
      "id": "SB",
      "name": "Short Bow / Mounted Bow",
      "heroPointCost": [
        3,
        4,
        5,
        6
      ],
      "range": 2
    },
    {
      "id": "BW",
      "name": "Bow / Mounted Elf Bow",
      "heroPointCost": [
        4,
        5,
        6,
        7
      ],
      "range": 3
    },
    {
      "id": "BS",
      "name": "Bow or Sling",
      "heroPointCost": [
        4,
        5,
        6,
        7
      ],
      "range": 3
    },
    {
      "id": "EB",
      "name": "Elf Bow / Crossbow / Longbow",
      "heroPointCost": [
        5,
        6,
        7,
        8
      ],
      "range": 4
    },
    {
      "id": "BD",
      "name": "Boulders",
      "heroPointCost": [],
      "range": 3
    },
    {
      "id": "DB",
      "name": "Dragon's Breath",
      "heroPointCost": [],
      "range": 3
    },
    {
      "id": "LA",
      "name": "Light Artillery",
      "heroPointCost": [],
      "range": 4
    },
    {
      "id": "HA",
      "name": "Heavy Artillery",
      "heroPointCost": [],
      "range": 5
    }
  ]
};
