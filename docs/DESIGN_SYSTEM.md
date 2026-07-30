
# JARVIS OS Design System v1.0
**Codename:** Red Tactical

---

# Philosophy

JARVIS OS is not a website or an admin dashboard.
It is a futuristic AI operating system focused on clarity, precision, and immersion.

Design goals:
- Premium
- Minimal
- Tactical
- Responsive
- Alive

---

# Visual Style

Keywords:
- Military
- Tactical
- Luxury
- Glassmorphism
- Precision
- Futuristic
- Professional

Avoid:
- Rainbow colors
- Excessive cyberpunk effects
- Visual clutter

---

# Color Palette

## Background
| Token | Value |
|-------|---------|
| Background Primary | #050505 |
| Background Secondary | #0A0A0A |
| Surface | #111111 |
| Panel | #171717 |
| Glass | rgba(18,18,18,0.65) |

## Primary Accent
| Token | Value |
|-------|---------|
| Jarvis Red | #E50000 |
| Hover Red | #FF2D2D |
| Glow | rgba(229,0,0,0.35) |
| Success | #2ECC71 |
| Warning | #F1C40F |
| Info | #4AA3FF |

## Text
| Token | Value |
|-------|---------|
| Primary | #FFFFFF |
| Secondary | #B8B8B8 |
| Muted | #7A7A7A |
| Disabled | #555555 |

---

# Typography

Primary: Geist

Fallback: Inter

Monospace: JetBrains Mono

## Font Sizes

Display: 64px
Hero: 48px
Title: 32px
Heading: 24px
Subheading: 20px
Body: 16px
Small: 14px
Caption: 12px
Micro: 10px

---

# Spacing Scale

4
8
12
16
20
24
32
40
48
64
96
128

Never invent custom spacing values.

---

# Border Radius

Cards: 20px
Buttons: 14px
Inputs: 12px
Windows: 18px
Orb: 9999px

---

# Shadows

Small:
0 0 10px rgba(0,0,0,.2)

Medium:
0 0 25px rgba(0,0,0,.4)

Large:
0 0 60px rgba(0,0,0,.6)

---

# Glow

Small:
0 0 8px rgba(229,0,0,.30)

Medium:
0 0 18px rgba(229,0,0,.35)

Large:
0 0 40px rgba(229,0,0,.50)

---

# Glassmorphism

Blur: 20px

Opacity: 65%

Border:
1px solid rgba(255,255,255,.06)

---

# Sidebar

Collapsed Width: 90px

Expanded Width: 280px

Icon Size: 24px

Hover: Red glow

---

# HUD

Height: 72px

Contains:
- Clock
- AI State
- Active Module
- Notifications
- Connection Status

---

# Buttons

Height: 44px

Primary:
Red

Secondary:
Dark

Hover:
Glow

Active:
Scale 0.98

---

# Inputs

Glass background

Rounded corners

Animated red focus border

---

# Animation Rules

Small:
200ms

Medium:
300ms

Large:
500ms

Maximum:
700ms

Easing:
easeOut

---

# Orb States

Idle

Listening

Thinking

Speaking

Executing

Error

Each state should have its own animation and glow.

---

# Background

Animated grid

Particles

Noise texture

Subtle radar sweep

Very light scan lines

---

# Module Accent Colors

JARVIS: Red

Producer: Purple

DJ: Blue

Business: Gold

Bar: Green

---

# Development Rules

- Reuse components.
- Never hardcode colors.
- Never invent spacing.
- Follow the typography scale.
- Keep animations subtle.
- Use TypeScript.
- Keep features modular.
