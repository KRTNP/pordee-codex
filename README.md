# pordee (พอดี)

> ทำไมใช้คำเยอะ ตอบสั้นๆ ก็เข้าใจ

ได้แรงบันดาลใจมาจาก [caveman](https://github.com/JuliusBrussee/caveman) — pordee เป็นรุ่นภาษาไทยที่ตัด token ทิ้งโดยไม่เสียความถูกต้องทาง technical

---

`pordee` คือ plugin สำหรับ Claude Code ที่ช่วยให้ agent ตอบภาษาไทยกระชับ — ตัดคำสุภาพ (ครับ/ค่ะ/นะคะ), คำลังเล (อาจจะ/น่าจะ), และคำเชื่อมที่ไม่จำเป็นทิ้ง เก็บ technical term อังกฤษไว้ตามเดิม

ผล: ใช้ token น้อยลง 60-75% เนื้อหาเท่าเดิม

---

## ติดตั้ง

### ผ่าน Claude Code plugin (แนะนำ)

```bash
claude plugin marketplace add kerlos/pordee
claude plugin install pordee@pordee
```

หลังติดตั้งเสร็จ hooks จะถูก register อัตโนมัติ — เริ่ม session ใหม่แล้ว `/pordee` ใช้ได้ทันที

---

### ผ่าน Codex แบบ global skill (`npx skills add`)

เหมาะถ้าอยากได้ `pordee` เป็น skill กลางของ Codex ทั้งเครื่อง โดยใช้ root skill นี้:

```text
skills/pordee/SKILL.md
```

ตัวอย่าง:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<ref>/skills/pordee
```

ผลลัพธ์:

- ติดตั้ง skill เข้า Codex global skills directory
- ได้ behavior ของ `pordee` จาก root skill โดยตรง
- ไม่ได้ติดตั้ง project-local plugin bundle

หลังติดตั้ง ให้ restart Codex

---

### ผ่าน Codex แบบ project-local plugin

ติดตั้งลงใน project เป้าหมายเท่านั้น ไม่ได้เป็น global install flow

Unix / macOS:

```bash
./install.sh --project /path/to/project
```

Windows PowerShell:

```powershell
.\install.ps1 -Project C:\path\to\project
```

ผลลัพธ์จะถูกเขียนลงที่:

| รายการ | ตำแหน่ง |
|---|---|
| plugin bundle | `<project>/.codex-plugins/pordee` |
| marketplace config | `<project>/.agents/plugins/marketplace.json` |

ตัวที่ติดตั้งคือ local plugin manifest + packaged skill เท่านั้น ยังไม่ vendor source-repo adapter/runtime/state-management code ลง target project

รันซ้ำได้อย่างปลอดภัย: installer จะ sync bundle ทับของเดิม และอัปเดต `marketplace.json` แบบไม่สร้าง `pordee` entry ซ้ำ

หลังติดตั้ง ให้ restart Codex แล้วเปิด `pordee` จาก Plugins UI ใน project นั้น

ลบเองแบบ manual:

1. ลบ `<project>/.codex-plugins/pordee`
2. ลบ entry `pordee` ออกจาก `<project>/.agents/plugins/marketplace.json`
3. restart Codex ใน project นั้นใหม่

### เลือกแบบไหนดี

| ทางติดตั้ง | scope | ติดตั้งอะไร | ใช้เมื่อ |
|---|---|---|---|
| `npx skills add .../skills/pordee` | global | root skill | อยากได้ `pordee` เป็น skill กลางของ Codex |
| `./install.sh --project ...` / `install.ps1` | project-local | local plugin bundle + marketplace entry | อยากเปิดใช้เฉพาะ repo เป้าหมาย |

## วิธีใช้

### Slash command

| คำสั่ง | ผล |
|---|---|
| `/pordee` | เปิด default level (full) |
| `/pordee lite` | โหมดเบา — ตัดคำสุภาพและ filler ออก แต่ grammar เต็ม |
| `/pordee full` | โหมดเต็ม — ตัดให้สั้นที่สุด |
| `/pordee stop` | ปิด |
| `/pordee stats` | ดู session/lifetime stats และ estimated token savings |

### Keyword (ไม่ต้องพิมพ์ slash)

พิมพ์คำเหล่านี้เป็นข้อความปกติในแชต — pordee จะเปิด/ปิดให้อัตโนมัติ ต้องเป็นข้อความทั้งบรรทัด ไม่ใช่ส่วนหนึ่งของประโยค

| Keyword | ผล |
|---|---|
| `พอดี` | เปิด |
| `พอดีโหมด` | เปิด |
| `พูดสั้นๆ` | เปิด |
| `พอดีสถิติ` | ดูสถิติ |
| `หยุดพอดี` | ปิด |
| `พูดปกติ` | ปิด |

### Stats

ใช้:

```text
/pordee stats
```

หรือ:

```text
พอดีสถิติ
```

ผลลัพธ์จะแสดง:

- session usage
- lifetime usage
- estimated token savings
- benchmark averages ของ `lite` กับ `full`

หมายเหตุ:

- ตัวเลข `tokens saved` เป็น `estimated` จาก built-in benchmark model
- ไม่ใช่ exact telemetry ของทุก historical reply

---

## Codex support

ส่วนนี้อธิบาย Codex support ฝั่ง source repo และ behavior ที่ออกแบบไว้สำหรับ adapter; project-local install ด้านบนจะได้เฉพาะ manifest + skill ที่ Codex โหลดไปใช้งาน

### Trigger ที่รองรับ

| Trigger | ผล |
|---|---|
| `/pordee` | เปิด default level (full) |
| `/pordee lite` | โหมดเบา |
| `/pordee full` | โหมดเต็ม |
| `/pordee stop` | ปิด |
| `พอดี` | เปิด |
| `พอดีโหมด` | เปิด |
| `พูดสั้นๆ` | เปิด |
| `หยุดพอดี` | ปิด |
| `พูดปกติ` | ปิด |

### Scope ของ state

state scope นี้อยู่ในฝั่ง source-repo adapter/runtime ไม่ใช่สิ่งที่ project-local bundle vendor มาให้โดยตรง

pordee อ่าน state ตามลำดับนี้:

1. `~/.pordee/state.json` สำหรับค่า global
2. `<repo>/.pordee/state.json` สำหรับ repo override
3. ค่า effective config = `repo override > global > defaults`

ตัวอย่าง:

- ถ้า global ตั้ง `enabled=true` แต่ repo ไม่มีไฟล์ override, repo นั้นจะใช้ค่า global
- ถ้า global ตั้ง `enabled=true` แต่ repo override ตั้ง `enabled=false`, repo นั้นจะปิด pordee แม้ global เปิดอยู่
- ถ้า repo override ไม่ได้กำหนดค่าส่วนนั้นไว้ ระบบจะ fall back ไปใช้ global ก่อน แล้วค่อยใช้ defaults

---

## ระดับ (Levels)

### 🪶 Lite — `/pordee lite`

ตัดคำสุภาพ (ครับ/ค่ะ/นะคะ), คำลังเลใจ (อาจจะ/น่าจะ/จริงๆแล้ว), และคำทักทาย (ได้เลยครับ/แน่นอน) ทิ้ง แต่เก็บ grammar เต็ม อ่านแล้วยังเป็นภาษาไทยปกติ professional

### ⚡ Full — `/pordee` หรือ `/pordee full` (default)

ตัดเหมือน lite + ตัด particle ที่ซ้ำซ้อน (ที่/ซึ่ง/ว่า/อยู่/กำลัง) + ตัด nominalizer (การ-, ความ-) + ใช้คำสั้น (ดู ไม่ใช่ ตรวจสอบ) + ประโยคสั้นได้

Pattern: `[ของ] [ทำ] [เหตุผล]. [ขั้นต่อ].`

---

## ก่อน / หลัง (Before / After)

### ตัวอย่าง 1 — "ทำไม React component ถึง re-render?"

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~80 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~45 tokens · 44% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~22 tokens · 73% saved</sub></th>
</tr>
<tr>
<td>"แน่นอนครับ ผมยินดีจะอธิบายให้นะครับ จริงๆ แล้วเหตุผลที่ React component ของคุณ re-render นั้น น่าจะเกิดจากการที่คุณส่ง object reference ใหม่เป็น prop ในทุกครั้งที่ component ถูก render ซึ่งทำให้ React มองว่า prop เปลี่ยน และทำการ re-render component ลูก ดังนั้นคุณอาจจะลองใช้ useMemo เพื่อ memoize object นั้นดูครับ"</td>
<td>"React component re-render เพราะส่ง object reference ใหม่เป็น prop ทุกครั้งที่ render ทำให้ React มองว่า prop เปลี่ยน และ re-render component ลูก ลองใช้ useMemo เพื่อ memoize object นั้น"</td>
<td>"Object ref ใหม่ทุก render. Inline object prop = ref ใหม่ = re-render. ห่อด้วย <code>useMemo</code>."</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  ████░░░░░░  44% saved        │
│  Full  ███████░░░  73% saved        │
└─────────────────────────────────────┘
```

---

### ตัวอย่าง 2 — "อธิบาย database connection pooling"

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~70 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~35 tokens · 50% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~18 tokens · 74% saved</sub></th>
</tr>
<tr>
<td>"ครับ การทำ database connection pooling นั้น โดยทั่วไปแล้วก็คือการที่เราเก็บ connection ของ database ที่เปิดไว้แล้ว เพื่อนำกลับมาใช้ใหม่อีกครั้ง แทนที่จะต้องเปิด connection ใหม่ทุกครั้งที่มี request เข้ามา ซึ่งจะช่วยลด overhead ของการทำ TCP handshake และ authentication ได้อย่างมีประสิทธิภาพ"</td>
<td>"Connection pooling เก็บ connection database ที่เปิดไว้แล้ว เพื่อนำกลับมาใช้ใหม่ ไม่ต้องเปิดใหม่ทุก request ลด overhead ของ TCP handshake และ authentication"</td>
<td>"Pool reuse connection ที่เปิดไว้. ไม่เปิดใหม่ทุก request. ข้าม TCP handshake."</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  █████░░░░░  50% saved        │
│  Full  ███████░░░  74% saved        │
└─────────────────────────────────────┘
```

---

### ตัวอย่าง 3 — Bug report (auth middleware)

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~55 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~30 tokens · 45% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~14 tokens · 75% saved</sub></th>
</tr>
<tr>
<td>"ครับ ผมตรวจสอบให้แล้วนะครับ ปัญหาที่คุณเจอน่าจะเกิดจาก bug ใน auth middleware ครับ จริงๆ แล้วในส่วนของ token expiry check นั้น โค้ดใช้เครื่องหมาย <code>&lt;</code> แทนที่จะเป็น <code>&lt;=</code> ซึ่งทำให้ token ที่หมดอายุพอดีไม่ถูก reject ดังนั้นเราควรจะแก้ตรงจุดนี้ครับ"</td>
<td>"Bug อยู่ที่ auth middleware ส่วน token expiry check ใช้ <code>&lt;</code> แทนที่จะเป็น <code>&lt;=</code> ทำให้ token ที่หมดอายุพอดีไม่ถูก reject แก้:"</td>
<td>"Bug ที่ auth middleware. Token expiry ใช้ <code>&lt;</code> ไม่ใช่ <code>&lt;=</code>. Fix:"</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  █████░░░░░  45% saved        │
│  Full  ████████░░  75% saved        │
└─────────────────────────────────────┘
```

---

### ตัวอย่าง 4 — "แนะนำอาหารกลางวันให้หน่อย"

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~70 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~32 tokens · 54% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~14 tokens · 80% saved</sub></th>
</tr>
<tr>
<td>"ได้เลยครับ จริงๆ แล้วการเลือกอาหารกลางวันก็ขึ้นอยู่กับหลายปัจจัยนะครับ เช่น งบประมาณ เวลาที่มี และความต้องการทางโภชนาการของคุณ ถ้าคุณอยากทานอาหารที่ทำง่ายและมีประโยชน์ ผมขอแนะนำว่าน่าจะลองทำสลัดไก่ย่างดูครับ เพราะว่ามีโปรตีนสูงและไม่ใช้เวลาเตรียมนานเลย"</td>
<td>"อาหารกลางวันขึ้นอยู่กับงบ เวลา และโภชนาการ ถ้าอยากกินง่ายและมีประโยชน์ ลองสลัดไก่ย่าง โปรตีนสูงและเตรียมไม่นาน"</td>
<td>"งบ + เวลา + โภชนาการ. ง่ายและดี → สลัดไก่ย่าง. โปรตีนสูง, เตรียมเร็ว."</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  █████░░░░░  54% saved        │
│  Full  ████████░░  80% saved        │
└─────────────────────────────────────┘
```

---

### ตัวอย่าง 5 — "เที่ยวเชียงใหม่ ไปเดือนไหนดี"

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~75 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~30 tokens · 60% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~12 tokens · 84% saved</sub></th>
</tr>
<tr>
<td>"ครับ ถ้าคุณอยากไปเที่ยวเชียงใหม่ ผมแนะนำว่าน่าจะไปช่วงเดือนพฤศจิกายนถึงกุมภาพันธ์ครับ เพราะว่าเป็นช่วงที่อากาศเย็นสบาย ไม่ร้อนเกินไป และไม่มีฝนตกบ่อยเหมือนช่วงอื่นๆ จริงๆ แล้วเดือนธันวาคมก็เป็นเดือนที่นิยมที่สุดเลยนะครับ แต่ก็จะคนเยอะหน่อย"</td>
<td>"ไปเชียงใหม่ ช่วงพฤศจิกายน-กุมภาพันธ์ดีที่สุด อากาศเย็นสบาย ไม่ร้อน ฝนน้อย ธันวาคมนิยมที่สุดแต่คนเยอะ"</td>
<td>"พ.ย.-ก.พ. ดีสุด. อากาศเย็น, ฝนน้อย. ธ.ค. คนเยอะ."</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  ██████░░░░  60% saved        │
│  Full  ████████░░  84% saved        │
└─────────────────────────────────────┘
```

---

### ตัวอย่าง 6 — "วิธีนอนหลับให้สนิท"

<table>
<tr>
<th width="34%">🗣️ Normal<br><sub>~70 tokens</sub></th>
<th width="33%">🪶 Lite<br><sub>~32 tokens · 54% saved</sub></th>
<th width="33%">⚡ Full<br><sub>~14 tokens · 80% saved</sub></th>
</tr>
<tr>
<td>"ครับ การนอนหลับให้สนิทนั้นมีหลายวิธีนะครับ ก่อนอื่นเลย คุณควรจะหลีกเลี่ยงการดื่มกาแฟหรือเครื่องดื่มที่มีคาเฟอีนหลังบ่ายสาม จริงๆ แล้วก็ควรจะปิดหน้าจอทุกชนิดอย่างน้อย 30 นาทีก่อนนอนนะครับ และพยายามเข้านอนเวลาเดิมทุกวันเพื่อให้ร่างกายปรับนาฬิกาชีวิต"</td>
<td>"นอนหลับสนิทมีหลายวิธี เลี่ยงคาเฟอีนหลังบ่ายสาม ปิดหน้าจอ 30 นาทีก่อนนอน เข้านอนเวลาเดิมทุกวันเพื่อปรับนาฬิกาชีวิต"</td>
<td>"เลี่ยงคาเฟอีนหลังบ่าย 3. ปิดจอ 30 นาทีก่อนนอน. เข้านอนเวลาเดิม → ปรับ circadian."</td>
</tr>
</table>

```
┌─────────────────────────────────────┐
│  Lite  █████░░░░░  54% saved        │
│  Full  ████████░░  80% saved        │
└─────────────────────────────────────┘
```

---

## กลไกการทำงาน

1. ติดตั้ง Claude plugin → Claude Code register hook ของ pordee อัตโนมัติ
2. เปิด Codex local plugin → Codex โหลด local manifest + packaged skill จาก `<project>/.codex-plugins/pordee`
3. ฝั่ง adapter/runtime ใน source repo ถ้ามีการใช้งาน state จะอ่านตามลำดับ `~/.pordee/state.json` แล้ว `<repo>/.pordee/state.json`
4. ถ้า `enabled=true` → inject กฎ pordee เข้า context ของ session
5. ทุก turn ที่ user พิมพ์ → UserPromptSubmit hook
   - ตรวจ trigger ใน prompt (`/pordee`, `/pordee lite`, `/pordee full`, `/pordee stop`, `พอดี`, `พอดีโหมด`, `พูดสั้นๆ`, `หยุดพอดี`, `พูดปกติ`)
   - update state ถ้าเจอ trigger
   - ฉีด reminder ของ level ปัจจุบันเข้า context (กันไม่ให้ model drift)
6. State ถาวรข้าม session และ merge ตาม precedence `repo override > global > defaults`

---

## ตอนไหนควรหยุดหรืออธิบายชัด

บางสถานการณ์ การพูดสั้นเกินไปอาจอันตรายหรือทำให้คนอ่านเข้าใจผิด แนวทางของ pordee คือขยับจากโหมดสั้นไปเป็นภาษาไทยปกติเต็มประโยคชั่วคราว แล้วค่อยกลับมาใช้โหมดเดิมในบริบทถัดไป

ถ้าผู้ใช้ต้องการให้อธิบายชัด ๆ คำต่อไปนี้ใช้เป็นสัญญาณให้ตอบยาวขึ้น:

| คำที่ผู้ใช้พิมพ์ | ความหมาย |
|---|---|
| `อะไรนะ` | ฟังไม่ทัน ขอใหม่ |
| `พูดอีกที` | ขอตอบซ้ำ |
| `อธิบายชัดๆ` | ขอละเอียดกว่านี้ |
| `ขยายความ` | ขอรายละเอียด |

นอกจากนี้ แนวทางตอบจะยอมขยายความเมื่อ:

- มี **security warning** หรือ ⚠️ ในคำตอบ
- คำสั่งที่ย้อนกลับไม่ได้ — `DROP TABLE`, `rm -rf`, `git push --force`, `git reset --hard`, `git branch -D`
- ขั้นตอนหลายสเต็ปที่ลำดับสำคัญ และ ประโยคสั้นเสี่ยงทำให้สับสน

หลังจบส่วนที่ต้องชัด pordee กลับมาโหมดเดิมทันที

---

## ข้อจำกัด

- README นี้แยก Claude Code install path กับ Codex project-local install path ออกจากกันชัดเจน
- Trigger, level และ state scope ใช้กับ Codex ได้ด้วย แต่ flow ติดตั้งของ Codex ใน README นี้ยังเป็นแบบ project-local เท่านั้น

---

## License

MIT
