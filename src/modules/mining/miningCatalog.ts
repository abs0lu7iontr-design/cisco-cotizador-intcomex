// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL CONDITIONS CATALOG
// ============================================================================

import { AccountConditionRule } from './types';
import { parseUsdAmount } from './usdAmountParser';

export const MINING_CONDITIONS_CATALOG: AccountConditionRule[] = [
  {
    groupId: 1,
    groupName: "Codelco",
    verifiedAliases: ["codelco", "coldeco", "chuquicamata", "el teniente", "radomiro tomic", "andina", "gabriela mistral", "dgm", "ministro hales", "dmh", "salvador", "fundicion ventanas"],
    productTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("20K")!, discountPct: 56 },
      { minUsd: parseUsdAmount("21K")!, maxUsd: parseUsdAmount("150K")!, discountPct: 58 }
      // El vacío 20K a 21K queda deliberadamente sin regla para evitar inventar condiciones
    ],
    subscriptionDiscountPct: 42,
    solutionSupportDiscountPct: 55,
    sntContractualRequired: true
  },
  {
    groupId: 2,
    groupName: "AMSA, Collahuasi, Lundin, Freeport",
    verifiedAliases: ["amsa", "antofagasta minerals", "pelambres", "centinela", "antucoya", "zaldivar", "collahuasi", "cmdic", "lundin", "candelaria", "ojos del salado", "caserones", "lumina copper", "freeport", "el abra"],
    productTiers: [
      { minUsd: parseUsdAmount("1K")!, maxUsd: parseUsdAmount("150K")!, discountPct: 58 }
    ],
    subscriptionDiscountPct: 42,
    solutionSupportDiscountPct: 55,
    sntContractualRequired: true
  },
  {
    groupId: 3,
    groupName: "Honeywell, Rockwell, Emerson, Schneider, Caterpillar, Bechtel, Sigdo Koppers",
    verifiedAliases: ["honeywell", "rockwell", "emerson", "schneider", "caterpillar", "bechtel", "sigdo koppers", "skic"],
    productTiers: [
      { minUsd: parseUsdAmount("1K")!, maxUsd: parseUsdAmount("150K")!, discountPct: 62 }
    ],
    subscriptionDiscountPct: 42,
    solutionSupportDiscountPct: 55,
    sntContractualRequired: true
  },
  {
    groupId: 4,
    groupName: "CAP/CMP, Enami, Molymet, SQM, Finning, Komatsu, Albemarle, Sierra Gorda, KGHM, Gold Fields",
    verifiedAliases: ["cap", "cmp", "compania minera del pacifico", "enami", "molymet", "sqm", "finning", "komatsu", "albemarle", "sierra gorda", "kghm", "goldfields", "gold fields", "salares norte"],
    productTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("150K")!, discountPct: 62 }
    ],
    subscriptionDiscountPct: 42,
    solutionSupportDiscountPct: 55,
    sntContractualRequired: true
  },
  {
    groupId: 5,
    groupName: "Anglo American y Mantos Copper",
    verifiedAliases: ["anglo american", "los bronces", "el soldado", "chagres", "mantos copper", "mantoverde", "mantos blancos", "capstone copper"],
    productTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("150K")!, discountPct: 65 }
    ],
    subscriptionDiscountPct: 50,
    solutionSupportDiscountPct: undefined, // No informado. Prohibido inventar 55%
    sntContractualRequired: true
  },
  {
    groupId: 6,
    groupName: "TECK",
    verifiedAliases: ["teck", "quebrada blanca", "qb2", "carmen de andacollo"],
    productTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("150K")!, discountPct: 62 }
    ],
    subscriptionDiscountPct: 62,
    solutionSupportDiscountPct: undefined, // No informado
    sntContractualRequired: true
  },
  {
    groupId: 7,
    groupName: "Glencore",
    verifiedAliases: ["glencore", "lomas bayas", "altonorte", "complejo metalurgico altonorte"],
    productTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("150K")!, discountPct: 68, tag: "NO_IOT" }
    ],
    iotProductTiers: [
      { minUsd: parseUsdAmount("0")!, maxUsd: parseUsdAmount("150K")!, discountPct: 60, tag: "IOT" }
    ],
    subscriptionDiscountPct: 68,
    iotSubscriptionDiscountPct: 50,
    solutionSupportDiscountPct: undefined, // No informado
    sntContractualRequired: true
  }
];
