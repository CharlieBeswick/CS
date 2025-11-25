# Crypto Tickets Economy System

**Document Version:** 1.0  
**Last Updated:** 2025-11-23

---

## Overview

The Crypto Tickets economy is built on a tiered ticket system with 8 tiers, where each tier represents a progression from the previous tier by a factor of 20.

### Baseline Assumptions

- **1 Bronze ticket** = 1 rewarded ad view
- **Baseline ad revenue** = $0.005 (0.5 cents) per rewarded ad view
- **Tier progression** = 20× multiplier (each tier is 20× the previous tier)

---

## Economic Model

### Value Calculations

For each tier, we track four different value metrics:

1. **bronzeEquivalent**: How many Bronze tickets 1 unit of this tier represents
   - Formula: `20^(tier_order - 1)`
   - Example: 1 Gold = 400 Bronze (20^2)

2. **adBackedValueUsd**: Pure ad revenue math
   - Formula: `bronzeEquivalent × $0.005`
   - Represents the theoretical value if all tickets were earned through ads

3. **inheritedValueUsd**: Ladder value based on previous tier
   - Formula: `previous_tier.pricedAtUsd × 20`
   - Represents what the tier "should" be worth by ladder progression

4. **pricedAtUsd**: Official internal valuation (intentionally discounted)
   - Manually set to balance the economy
   - Typically lower than inheritedValueUsd to create economic incentives

---

## Tier Economy Table

| Tier | Bronze Equivalent | Ad-Backed Value (USD) | Inherited Value (USD) | Priced At (USD) |
|------|------------------|----------------------|---------------------|----------------|
| **BRONZE** | 1 | $0.005 | $0.005 | $0.005 |
| **SILVER** | 20 | $0.10 | $0.10 | $0.08 |
| **GOLD** | 400 | $2.00 | $1.60 | $1.50 |
| **EMERALD** | 8,000 | $40.00 | $30.00 | $25.00 |
| **SAPPHIRE** | 160,000 | $800.00 | $500.00 | $420.00 |
| **RUBY** | 3,200,000 | $16,000.00 | $8,400.00 | $7,500.00 |
| **AMETHYST** | 64,000,000 | $320,000.00 | $150,000.00 | $100,000.00 |
| **DIAMOND** | 1,280,000,000 | $6,400,000.00 | $2,000,000.00 | $1,000,000.00 |

### Notes

- **BRONZE** is the base tier, directly tied to ad revenue
- **SILVER** through **DIAMOND** are derived through the 20× progression
- **pricedAtUsd** values are intentionally discounted to:
  - Create economic incentives for progression
  - Account for game mechanics and player engagement
  - Balance the reward structure

---

## Tier Queue System (Design)

### Queue Structure

For each tier 1-7 (BRONZE to AMETHYST), there are 3 queue sizes:

| Queue Size | Players Required | Reward (Next Tier) |
|-----------|-----------------|-------------------|
| **Small** | 20 | 1 ticket |
| **Medium** | 40 | 2 tickets |
| **Large** | 60 | 3 tickets |

### Entry Cost

- **Always 1 ticket** of the current tier per player per game
- Ticket is **staked** when joining the queue
- Ticket is **burned** when the game resolves (regardless of win/loss)

### Example: BRONZE → SILVER

- Player joins **Small BRONZE queue** (20 players)
- Entry cost: 1 BRONZE ticket (burned)
- When queue fills: Random winner selected
- Winner receives: 1 SILVER ticket
- All 20 entry tickets are burned

### Progression Path

```
BRONZE → SILVER → GOLD → EMERALD → SAPPHIRE → RUBY → AMETHYST → DIAMOND
```

- Each tier has 3 queue options (Small/Medium/Large)
- Higher queue sizes offer better rewards but take longer to fill
- DIAMOND has no queues (top tier, no progression)

---

## Internal-Only Values

**⚠️ IMPORTANT:** All USD values in the economy config are **INTERNAL ONLY**.

These values must **NEVER** be:
- Displayed to players in the UI
- Exposed in API responses
- Used in user-facing communications

They are used for:
- Internal analytics and tracking
- Economic modeling and balance calculations
- Future reward calculations
- Backend decision-making

---

## Implementation Status

### ✅ Completed

- Economy configuration (`config/economy.js`)
- Queue configuration stubs (`config/queues.js`)
- Helper functions for conversions
- Documentation

### 🚧 TODO: Future Implementation

1. **Queue State Storage**
   - [ ] Create Prisma models for `TierGameQueue` and `QueueEntry`
   - [ ] Implement queue state tracking (WAITING, FILLED, IN_PROGRESS, FINISHED)
   - [ ] Add queue metadata (createdAt, filledAt, resolvedAt)

2. **Queue Join Logic**
   - [ ] Implement `POST /api/tier-games/:tier/:size/join` endpoint
   - [ ] Validate user has required tier ticket
   - [ ] Atomically consume ticket and create queue entry
   - [ ] Prevent duplicate entries (one entry per user per queue)

3. **Queue Resolution**
   - [ ] Auto-resolve when queue fills (20/40/60 players)
   - [ ] Random winner selection (server-side, cryptographically secure)
   - [ ] Award next-tier tickets to winner
   - [ ] Burn all entry tickets
   - [ ] Create transaction records for audit

4. **Frontend Integration**
   - [ ] Replace stub tier game buttons with real queue join logic
   - [ ] Show queue status (players in queue, time remaining)
   - [ ] Display queue results
   - [ ] Show wallet updates after queue resolution

5. **Analytics & Monitoring**
   - [ ] Track queue fill times
   - [ ] Monitor tier progression rates
   - [ ] Analyze reward distribution
   - [ ] Compare real ad revenue vs. $0.005 assumption

---

## Future Enhancements

### Regional eCPM Adjustments

**TODO:** Model region-based eCPM adjustments (EU/US/EM, etc.)

Different regions may have different ad revenue rates:
- US: Higher eCPM (~$0.005-0.01)
- EU: Moderate eCPM (~$0.003-0.007)
- Emerging Markets: Lower eCPM (~$0.001-0.003)

This could affect:
- `adBackedValueUsd` calculations
- Regional pricing adjustments
- Reward balancing

### Real Revenue Tracking

**TODO:** Add analytics to track real average revenue per Bronze and compare to $0.005 assumption

- Track actual ad revenue per view
- Compare to baseline assumption
- Adjust economy if real data diverges significantly

### Economic Rebalancing

**TODO:** Rebalance `pricedAtUsd` if real data diverges from assumptions

If real ad revenue is:
- **Higher than $0.005**: May need to increase `pricedAtUsd` to maintain balance
- **Lower than $0.005**: May need to decrease `pricedAtUsd` or adjust rewards

### Dynamic Pricing

**TODO:** Consider dynamic pricing based on:
- Queue fill rates
- Player engagement metrics
- Ad revenue trends
- Market conditions

---

## Code References

- **Economy Config:** `config/economy.js`
- **Queue Config:** `config/queues.js`
- **Tier Definitions:** `config/tickets.js`
- **Wallet Helpers:** `lib/walletHelpers.js`

---

## Questions & Considerations

1. **Should DIAMOND have any special mechanics?**
   - Currently, DIAMOND is the top tier with no progression
   - Could add special events, leaderboards, or exclusive rewards

2. **How to handle queue abandonment?**
   - If a queue doesn't fill within X hours, should it auto-resolve?
   - Should partial rewards be given if queue is abandoned?

3. **Queue priority/premium options?**
   - Should players be able to pay extra to join faster queues?
   - Or should all queues be equal-access?

4. **Cross-tier conversions?**
   - Should players be able to convert down (e.g., 1 GOLD → 20 SILVER)?
   - Or should progression be one-way only?

---

**End of Document**

