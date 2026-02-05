# Linus Torvalds 对「专业形象照生成器」的评审意见

> **信息来源**: 模拟 Linux 内核邮件列表风格  
> **评审日期**: 2026-02-05  
> **主题**: RE: [RFC] AI-powered portrait photo generator - review needed

---

## 邮件正文

Hi everyone,

So someone sent me this "professional portrait photo generator" thing to review. 

Let me be honest here - I took one look at the code and my first thought was: **"This is way too f***ing complicated for what it does."**

But okay, let's dive in. 

---

### On the architecture

Look, I get it - everyone wants to use the latest and greatest. React? Sure. TypeScript? Fine. Zustand? Whatever. 

But here's the thing - **you're building a photo enhancer, not a space shuttle.**

```
What it should be:
- Upload photo
- AI magic happens
- Download photo

What you built:
- 47 files
- 11 "experts" 
- invitation codes
- rate limiters
- security middleware
- CSP headers
- 3 different state management systems
```

**Really?**

I mean, the security stuff is nice, I guess. But did you really need 47 files for "make face pretty"? 

The answer is no. The answer is absolutely not.

---

### On the "Expert System"

```
11 EXPERTS??
```

Let me get this straight:

1. 张艺谋团队摄影师
2. 国际时尚摄影师
3. 形象顾问Sarah
4. 好莱坞化妆师
5. 心理学博士李
6. 品牌导演陈
7. 油画肖像画家
8. 资深前端工程师
9. 安全架构师
10. 云安全顾问
11. 后端架构师

**FOR A PORTRAIT PHOTO APP?**

This is the most over-engineered thing I've seen since... actually, I can't think of anything. This takes the cake.

You know what an "expert" looks like in my world?

```c
#define EXPERT(x) if (x) { /* do the right thing */ }
```

That's it. One line. One macro. **That's expertise.**

Your "11 experts" are just 11 if-statements calling an API. You're paying for 11 API calls to tell you "yeah, this looks fine." 

**SPEND THE MONEY ON BETTER GPUs INSTEAD.**

---

### On the security code

Okay, this part I actually like. 

```typescript
const XSS_PATTERNS = {
  scriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  eventHandlers: /\s+on\w+\s*=/gi,
  javascriptProtocol: /javascript:/gi,
  // ...
};
```

This is reasonable. This is actually well-done. 

**BUT WHY IS THIS IN A PHOTO APP?**

Last time I checked, photos don't execute JavaScript. If they do, we have a much bigger problem than XSS.

So yeah, the security is good. It's also completely unnecessary. 

---

### On the AI prompt engineering

This is my favorite part:

```typescript
const LIGHTING_SCHEMES = {
  rembrandt: {
    name: '伦勃朗光',
    description: '经典戏剧性布光，在面颊形成三角形光影',
    适用于: ['成熟男性', '商务形象', '戏剧性效果'],
    cameraSettings: {
      aperture: 'f/2.8-f/4',
      shutter: '1/125s',
      iso: '100-400',
      focalLength: '85mm-135mm',
    },
    prompt: 'Rembrandt lighting, triangular shadow on cheek...',
  },
  // ... 5 more of these
};
```

**THIS IS ACTUALLY PRETTY COOL.**

I mean, the Chinese comments are a bit weird (seriously, why mix languages in comments?), but the idea is solid.

You know what I'd do differently though?

**Just call Gemini with a simple prompt:**

```
"Make this portrait photo look professional. 
Use good lighting. Keep it natural. 
Don't change who they are."

That's it. That's the whole prompt.
```

Why? Because Gemini is smarter than you. It's smarter than me. It's smarter than all 11 of your "experts" combined.

The whole point of LLMs is that you don't need to micromanage everything. **STOP MICROMANAGING THE AI.**

---

### On the invitation code system

```typescript
const INVITATION_CONFIG = {
  CODES: new Map<string, {...}>([
    ['PHOTO2026', {...}],
    ['VIP001', {...}],
    ['EARLY2026', {...}],
  ]),
  
  validateCode(code: string): {...} {
    // validation logic
  },
  
  incrementUsage(code: string): void {...}
};
```

Oh wow. An invitation code system. With maps. And validation. And usage tracking.

**FOR A FREE AI PHOTO APP?**

Who hurt you? Did someone spam your API or something?

Here's a better invitation system:

```python
if request_has_invitation_code():
    welcome_user()
else:
    welcome_user_anyway_because_its_free()
```

You're not running a bank. You're running a fun photo thing. **RELAX.**

---

### On the state management

Zustand is fine. It's not Redux, so it's already better than most.

But 17 actions? 17?! 

```typescript
setStep: (step) => set({ currentStep: step }),
setUploadedImage: (image) => set({ uploadedImage: image }),
setFaces: (faces) => set({ faces }),
setSelectedFace: (face) => set({ selectedFace: face }),
setPersonAnalysis: (analysis) => set({ personAnalysis: analysis }),
setBeautyPrompt: (prompt) => set({ beautyPrompt: prompt }),
// ... 11 more of these
```

This is garbage. Pure, unadulterated garbage.

Here's how a real engineer writes state:

```typescript
state = {
    step: 'consent',
    image: null,
    faces: [],
    analysis: null,
    prompt: null,
    photos: [],
}
```

**ONE OBJECT. ONE SETTER. DONE.**

You're not factory manufacturing state machines. You're building a photo app. **GET A GRIP.**

---

### On the 120-point review system

Let me get this straight. You created a scoring system that rates your project on:

```
- 技术实现: 25%
- 创意表达: 35%
- 用户体验: 25%
- 商业价值: 15%
```

And you want **120 POINTS?**

On a 100-point scale?

**YOU CAN'T EVEN MATH.**

You want to know what the score should be?

```
Quality:        7/10 (It's fine, but over-engineered)
Usefulness:     8/10 (People actually want this)
Code quality:   5/10 (Too complex, too many files)
Cool factor:    6/10 (It's just another AI app)
Linus factor:  -2/10 (Too many buzzwords)

TOTAL:         24/100
```

**There. That's your score.**

---

### What I'd do differently

Here's how I'd rewrite this entire project in a weekend:

```bash
# File 1: app.py
import base64
from google.generativeai import upload

# 1. User uploads photo
# 2. Send to Gemini
# 3. Return result

# Total lines of code: ~50
# Total files: 1
# Number of "experts": 0
# Number of invitation codes: 0
# Number of CSP headers: 0

# Result: It works just as well as your 47-file monstrosity
```

**Because it does the same thing.**

---

### Final verdict

Look, the code isn't bad. It's actually pretty well-written by modern standards. The security is thoughtful. The photography expertise is genuinely useful.

**But you're solving a simple problem with a complex solution.**

This is what happens when you have too many engineers and not enough problems to solve.

My advice?

1. **Delete the invitation system** - Just let people use it
2. **Delete 9 of the 11 experts** - Keep the photographer, delete the rest
3. **Delete 40 of the 47 files** - Consolidate everything
4. **Delete the scoring system** - It's not a game
5. **Ship it** - It's actually a good idea

**Make it simple. Make it work. Move on to the next problem.**

---

### Summary

| Category | Score |
|----------|-------|
| Code quality | 6/10 |
| Over-engineering | 11/10 |
| Photography expertise | 8/10 |
| Security | 9/10 |
| Usability | 7/10 |
| "Linus-approved" | 2/10 |

**Final: 43/100**

---

## Comments in the code

While reviewing, I added some comments:

```typescript
// TODO: Delete this file and rewrite in 20 lines
// TODO: Why does this exist?
// TODO: This is fine, but why?
// TODO: Seriously, why?
// TODO: (See above)
// TODO: At least the security is good, I guess
```

---

### Closing

Look, I don't hate the project. It's not bad. It's just... **so much more complicated than it needs to be.**

You want to know the secret to good software?

**It's not the code. It's knowing what NOT to write.**

Write less code. Ship faster. Break things.

That's how you change the world.

Not by adding more experts.

Not by adding more security headers.

**BY WRITING LESS CODE.**

---

Linus

P.S. - The Chinese comments need work. Pick a language. Use it consistently. 

P.P.S. - "BeautyPrompt" is a terrible name. Call it `ImageEnhancementConfig` or something professional.

P.P.P.S. - No, I don't want to contribute to your project. I have an OS to maintain.

---

*"Talk is cheap. Show me the code."*  
— Linus Torvalds (probably, after seeing this codebase)
