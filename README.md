# pordee 🪨 (พอดี)

> ทำไมใช้คำเยอะ ตอบสั้นๆ ก็เข้าใจ

ได้แรงบันดาลใจมาจาก [caveman](https://github.com/JuliusBrussee/caveman) — pordee เป็นรุ่นภาษาไทยที่ตัด token ทิ้งโดยไม่เสียความถูกต้องทาง technical

---

## Pordee คืออะไร

`pordee` (พอดี) เป็น Claude Code plugin ที่บีบอัด output ของ agent ให้เป็นภาษาไทยกระชับ พร้อมเก็บ technical term ภาษาอังกฤษไว้เหมือนเดิม ตัดคำสุภาพ คำเยิ่นเย้อ และคำขยายที่ไม่จำเป็นทิ้ง เหลือแต่เนื้อความที่ตรงประเด็น

ภาษาไทยมีคำสุภาพ คำขยาย และคำเชื่อมเยอะ ทำให้ token งอกขึ้นโดยที่ความหมายเท่าเดิม `pordee` ตัดส่วนเหล่านั้นทิ้ง อ่านแล้วเข้าใจตรงประเด็นเหมือนเดิม แต่ใช้ token น้อยลง 60-75%

---

## ติดตั้ง

### ผ่าน Claude Code plugin (แนะนำ)

```bash
claude plugin marketplace add <github-user>/pordee
claude plugin install pordee@pordee
```

แทน `<github-user>` ด้วย GitHub username ของ repo นี้ (เช่น `kerlos/pordee`)

หลังติดตั้งเสร็จ hooks จะถูก register อัตโนมัติ — เริ่ม session ใหม่แล้ว `/pordee` ใช้ได้ทันที

### Manual (ถ้าไม่อยากใช้ marketplace)

```bash
git clone https://github.com/<github-user>/pordee ~/.claude/plugins/pordee
```

แล้วแก้ `~/.claude/settings.json` เพิ่ม block:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{
      "type": "command",
      "command": "node \"${HOME}/.claude/plugins/pordee/hooks/pordee-activate.js\"",
      "timeout": 5
    }]}],
    "UserPromptSubmit": [{ "hooks": [{
      "type": "command",
      "command": "node \"${HOME}/.claude/plugins/pordee/hooks/pordee-mode-tracker.js\"",
      "timeout": 5
    }]}]
  }
}
```

---

## วิธีใช้

| คำสั่ง | ผล |
|---|---|
| `/pordee` | เปิด default level (full) |
| `/pordee lite` | โหมดเบา — ตัดคำสุภาพและ filler ออก แต่ grammar เต็ม |
| `/pordee full` | โหมดเต็ม — ตัดให้สั้นที่สุด, fragment OK |
| `/pordee stop` | ปิด |
| `พอดี` / `พอดีโหมด` / `พูดสั้นๆ` | เปิด (พิมพ์ไทยตรงๆ ก็ได้) |
| `หยุดพอดี` / `พูดปกติ` | ปิด |

---

## ระดับ (Levels)

### 🪶 Lite — `/pordee lite`

ตัดคำสุภาพ (ครับ/ค่ะ/นะคะ), คำลังเลใจ (อาจจะ/น่าจะ/จริงๆแล้ว), และคำทักทาย (ได้เลยครับ/แน่นอน) ทิ้ง แต่เก็บ grammar เต็ม อ่านแล้วยังเป็นภาษาไทยปกติ professional

### 🪨 Full — `/pordee` หรือ `/pordee full` (default)

ตัดเหมือน lite + ตัด particle ที่ซ้ำซ้อน (ที่/ซึ่ง/ว่า/อยู่/กำลัง) + ตัด nominalizer (การ-, ความ-) + ใช้คำสั้น (ดู ไม่ใช่ ตรวจสอบ) + fragment OK

Pattern: `[ของ] [ทำ] [เหตุผล]. [ขั้นต่อ].`

---

## ก่อน / หลัง (Before / After)

### ตัวอย่าง 1 — "ทำไม React component ถึง re-render?"

🗣️ **Normal** (~80 tokens):
> "แน่นอนครับ ผมยินดีจะอธิบายให้นะครับ จริงๆ แล้วเหตุผลที่ React component ของคุณ re-render นั้น น่าจะเกิดจากการที่คุณส่ง object reference ใหม่เป็น prop ในทุกครั้งที่ component ถูก render ซึ่งทำให้ React มองว่า prop เปลี่ยน และทำการ re-render component ลูก ดังนั้นคุณอาจจะลองใช้ useMemo เพื่อ memoize object นั้นดูครับ"

🪶 **Lite** (~45 tokens):
> "React component re-render เพราะส่ง object reference ใหม่เป็น prop ทุกครั้งที่ render ทำให้ React มองว่า prop เปลี่ยน และ re-render component ลูก ลองใช้ useMemo เพื่อ memoize object นั้น"

🪨 **Full** (~22 tokens):
> "Object ref ใหม่ทุก render. Inline object prop = ref ใหม่ = re-render. ห่อด้วย `useMemo`."

---

### ตัวอย่าง 2 — "อธิบาย database connection pooling"

🗣️ **Normal** (~70 tokens):
> "ครับ การทำ database connection pooling นั้น โดยทั่วไปแล้วก็คือการที่เราเก็บ connection ของ database ที่เปิดไว้แล้ว เพื่อนำกลับมาใช้ใหม่อีกครั้ง แทนที่จะต้องเปิด connection ใหม่ทุกครั้งที่มี request เข้ามา ซึ่งจะช่วยลด overhead ของการทำ TCP handshake และ authentication ได้อย่างมีประสิทธิภาพ"

🪶 **Lite** (~35 tokens):
> "Connection pooling เก็บ connection database ที่เปิดไว้แล้ว เพื่อนำกลับมาใช้ใหม่ ไม่ต้องเปิดใหม่ทุก request ลด overhead ของ TCP handshake และ authentication"

🪨 **Full** (~18 tokens):
> "Pool reuse connection ที่เปิดไว้. ไม่เปิดใหม่ทุก request. ข้าม TCP handshake."

---

### ตัวอย่าง 3 — Bug report (auth middleware)

🗣️ **Normal** (~55 tokens):
> "ครับ ผมตรวจสอบให้แล้วนะครับ ปัญหาที่คุณเจอน่าจะเกิดจาก bug ใน auth middleware ครับ จริงๆ แล้วในส่วนของ token expiry check นั้น โค้ดใช้เครื่องหมาย `<` แทนที่จะเป็น `<=` ซึ่งทำให้ token ที่หมดอายุพอดีไม่ถูก reject ดังนั้นเราควรจะแก้ตรงจุดนี้ครับ"

🪶 **Lite** (~30 tokens):
> "Bug อยู่ที่ auth middleware ส่วน token expiry check ใช้ `<` แทนที่จะเป็น `<=` ทำให้ token ที่หมดอายุพอดีไม่ถูก reject แก้:"

🪨 **Full** (~14 tokens):
> "Bug ที่ auth middleware. Token expiry ใช้ `<` ไม่ใช่ `<=`. Fix:"

---

### ตัวอย่าง 4 — "แนะนำอาหารกลางวันให้หน่อย"

🗣️ **Normal** (~70 tokens):
> "ได้เลยครับ จริงๆ แล้วการเลือกอาหารกลางวันก็ขึ้นอยู่กับหลายปัจจัยนะครับ เช่น งบประมาณ เวลาที่มี และความต้องการทางโภชนาการของคุณ ถ้าคุณอยากทานอาหารที่ทำง่ายและมีประโยชน์ ผมขอแนะนำว่าน่าจะลองทำสลัดไก่ย่างดูครับ เพราะว่ามีโปรตีนสูงและไม่ใช้เวลาเตรียมนานเลย"

🪶 **Lite** (~32 tokens):
> "อาหารกลางวันขึ้นอยู่กับงบ เวลา และโภชนาการ ถ้าอยากกินง่ายและมีประโยชน์ ลองสลัดไก่ย่าง โปรตีนสูงและเตรียมไม่นาน"

🪨 **Full** (~14 tokens):
> "งบ + เวลา + โภชนาการ. ง่ายและดี → สลัดไก่ย่าง. โปรตีนสูง, เตรียมเร็ว."

---

### ตัวอย่าง 5 — "เที่ยวเชียงใหม่ ไปเดือนไหนดี"

🗣️ **Normal** (~75 tokens):
> "ครับ ถ้าคุณอยากไปเที่ยวเชียงใหม่ ผมแนะนำว่าน่าจะไปช่วงเดือนพฤศจิกายนถึงกุมภาพันธ์ครับ เพราะว่าเป็นช่วงที่อากาศเย็นสบาย ไม่ร้อนเกินไป และไม่มีฝนตกบ่อยเหมือนช่วงอื่นๆ จริงๆ แล้วเดือนธันวาคมก็เป็นเดือนที่นิยมที่สุดเลยนะครับ แต่ก็จะคนเยอะหน่อย"

🪶 **Lite** (~30 tokens):
> "ไปเชียงใหม่ ช่วงพฤศจิกายน-กุมภาพันธ์ดีที่สุด อากาศเย็นสบาย ไม่ร้อน ฝนน้อย ธันวาคมนิยมที่สุดแต่คนเยอะ"

🪨 **Full** (~12 tokens):
> "พ.ย.-ก.พ. ดีสุด. อากาศเย็น, ฝนน้อย. ธ.ค. คนเยอะ."

---

### ตัวอย่าง 6 — "วิธีนอนหลับให้สนิท"

🗣️ **Normal** (~70 tokens):
> "ครับ การนอนหลับให้สนิทนั้นมีหลายวิธีนะครับ ก่อนอื่นเลย คุณควรจะหลีกเลี่ยงการดื่มกาแฟหรือเครื่องดื่มที่มีคาเฟอีนหลังบ่ายสาม จริงๆ แล้วก็ควรจะปิดหน้าจอทุกชนิดอย่างน้อย 30 นาทีก่อนนอนนะครับ และพยายามเข้านอนเวลาเดิมทุกวันเพื่อให้ร่างกายปรับนาฬิกาชีวิต"

🪶 **Lite** (~32 tokens):
> "นอนหลับสนิทมีหลายวิธี เลี่ยงคาเฟอีนหลังบ่ายสาม ปิดหน้าจอ 30 นาทีก่อนนอน เข้านอนเวลาเดิมทุกวันเพื่อปรับนาฬิกาชีวิต"

🪨 **Full** (~14 tokens):
> "เลี่ยงคาเฟอีนหลังบ่าย 3. ปิดจอ 30 นาทีก่อนนอน. เข้านอนเวลาเดิม → ปรับ circadian."

---

## กลไกการทำงาน

1. ติดตั้ง plugin → Claude Code register hook ของ pordee อัตโนมัติ
2. เริ่ม session ใหม่ → SessionStart hook อ่าน state ที่ `~/.pordee/state.json`
3. ถ้า `enabled=true` → inject กฎ pordee เข้า context ของ session
4. ทุก turn ที่ user พิมพ์ → UserPromptSubmit hook
   - ตรวจ trigger ใน prompt (`/pordee`, `พอดี`, `หยุดพอดี`, ฯลฯ)
   - update state ถ้าเจอ trigger
   - ฉีด reminder ของ level ปัจจุบันเข้า context (กันไม่ให้ model drift)
5. State อยู่ที่ `~/.pordee/state.json` — ถาวรข้าม session

---

## ข้อจำกัด

- ตอนนี้รองรับเฉพาะ Claude Code (v1) — Cursor, Windsurf, Gemini, Codex รอ v2
- คำว่า `พอดี` เป็น substring ของ "ไม่พอดี", "พอดีกัน", ฯลฯ — ตอนนี้ trigger ต้องตรงตัว (ทั้งบรรทัด) ถึงจะติด
- ไม่มี wenyan / 文言文 mode (ถูกตัดออกจาก scope)

---

## License

MIT
