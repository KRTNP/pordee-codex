# pordee (พอดี)

> ทำไมใช้คำเยอะ ตอบสั้นๆ ก็เข้าใจ

`pordee` คือโหมดการสื่อสารแบบ Thai-first สำหรับ Agent Coding Tools ที่เน้นการตอบกลับให้สั้นลง แต่ยังคงความถูกต้องทางเทคนิค (Technical Accuracy) ไว้ ได้แรงบันดาลใจจาก [caveman](https://github.com/JuliusBrussee/caveman) แต่ปรับให้โฟกัสที่ภาษาไทยและ Workflow ที่มีการใช้ภาษาไทยปนอังกฤษ

ปัจจุบัน Repository นี้รองรับการใช้งานหลักๆ ดังนี้:

- `Claude Code` ผ่าน Plugin และ Hooks
- `Codex` ผ่าน Global Skill และ Project-local Plugin

เป้าหมายหลัก:

- ลดการใช้คำสุภาพที่เกินจำเป็น, คำฟุ่มเฟือย (Filler) และการใช้คำเลี่ยง (Hedging)
- คงคำศัพท์เฉพาะทางเทคนิคภาษาอังกฤษไว้ตามเดิม
- ลดความยาวของ Output โดยไม่ทำให้สูญเสียความชัดเจนทางเทคนิค

## ติดตั้ง

### Claude Code plugin

เหมาะสำหรับผู้ที่ใช้งาน `Claude Code` เป็นหลัก

```bash
claude plugin marketplace add kerlos/pordee
claude plugin install pordee@pordee

```

หลังจากติดตั้ง:

- Hooks จะถูกลงทะเบียน (Register) โดยอัตโนมัติ
- สามารถเริ่มต้น Session ใหม่และใช้งานคำสั่ง `/pordee` ได้ทันที

### Codex global skill

เหมาะสำหรับกรณีที่ต้องการให้ `pordee` เป็น Skill กลางของ Codex สำหรับใช้งานทั้งเครื่อง

Source ที่ใช้:

```text
skills/pordee/SKILL.md

```

ตัวอย่าง:

```bash
npx skills add [https://github.com/](https://github.com/)<owner>/<repo>/tree/<ref>/skills/pordee

```

ผลลัพธ์จากการติดตั้ง:

- ติดตั้ง Global Skill เข้าสู่ Codex
- ใช้งาน Behavior จาก Root Skill ได้โดยตรง
- ไม่มีการติดตั้ง Project-local Plugin Bundle

หลังจากติดตั้งเรียบร้อยแล้ว ให้ทำการ Restart Codex

### Codex project-local plugin

เหมาะสำหรับกรณีที่ต้องการเปิดใช้งานเฉพาะบางโปรเจกต์เป้าหมาย

Unix / macOS:

```bash
./install.sh --project /path/to/project

```

Windows PowerShell:

```powershell
.\install.ps1 -Project C:\path\to\project

```

ผลลัพธ์:

| รายการ             | ตำแหน่ง                                      |
| ------------------ | -------------------------------------------- |
| plugin bundle      | `<project>/.codex-plugins/pordee`            |
| marketplace config | `<project>/.agents/plugins/marketplace.json` |

หมายเหตุ:

- Installer จะทำการคัดลอก Local Plugin Manifest และ Packaged Skill
- ยังไม่ได้ทำ Vendor Runtime/State Layer ของ Source Repo ทั้งหมดลงใน Target Project
- สามารถรันคำสั่งซ้ำได้อย่างปลอดภัย ระบบจะทำการ Sync Bundle และอัปเดต Marketplace โดยไม่สร้าง Entry ซ้ำซ้อน

วิธีการถอนการติดตั้งด้วยตนเอง (Manual):

1. ลบ `<project>/.codex-plugins/pordee`
2. ลบ Entry `pordee` ออกจาก `<project>/.agents/plugins/marketplace.json`
3. Restart Codex ภายในโปรเจกต์นั้น

### เลือกวิธีติดตั้งแบบไหนดี

| รูปแบบการติดตั้ง                             | Scope          | สิ่งที่ได้รับ           | เหมาะสำหรับ                             |
| -------------------------------------------- | -------------- | ----------------------- | --------------------------------------- |
| Claude plugin                                | Claude session | Hooks + Persistent mode | ผู้ที่ใช้งาน Claude Code                |
| `npx skills add .../skills/pordee`           | global         | Codex global skill      | ต้องการเปิดใช้งานในทุก Repository       |
| `./install.sh --project ...` / `install.ps1` | project-local  | Local plugin bundle     | ต้องการเปิดใช้งานเฉพาะ Repository นั้นๆ |

## วิธีใช้งาน

### Slash Commands

| คำสั่ง          | ผลลัพธ์                             |
| --------------- | ----------------------------------- |
| `/pordee`       | เปิดใช้งานโหมด Default (`full`)     |
| `/pordee lite`  | เปิดใช้งานโหมด `lite`               |
| `/pordee full`  | เปิดใช้งานโหมด `full`               |
| `/pordee stop`  | ปิดโหมด                             |
| `/pordee stats` | ดูสถิติของ `session` และ `lifetime` |

### Thai Keyword Triggers

ข้อความจะต้องพิมพ์แยกเป็นบรรทัดใหม่เท่านั้น ไม่สามารถใช้เป็นส่วนหนึ่งของประโยคได้

| Keyword     | ผลลัพธ์  |
| ----------- | -------- |
| `พอดี`      | เปิดโหมด |
| `พอดีโหมด`  | เปิดโหมด |
| `พูดสั้นๆ`  | เปิดโหมด |
| `หยุดพอดี`  | ปิดโหมด  |
| `พูดปกติ`   | ปิดโหมด  |
| `พอดีสถิติ` | ดูสถิติ  |

## Levels

### `lite`

เหมาะสำหรับเวลาที่ยังต้องการให้ภาษาไทยดูเป็นธรรมชาติ

- ตัดคำสุภาพที่เกินจำเป็น
- ตัดคำฟุ่มเฟือยและคำเลี่ยง
- โครงสร้างไวยากรณ์ยังครบถ้วน
- อ่านแล้วใกล้เคียงกับการเขียนรูปแบบปกติ

### `full`

เหมาะสำหรับเวลาที่ต้องการประหยัด Token ให้มากที่สุด

- ใช้กฎทั้งหมดจากโหมด `lite`
- ตัดคำซ้ำซ้อนเพิ่มเติม
- เน้นการใช้คำสั้นกระชับ
- อนุญาตให้ใช้ประโยคที่ไม่สมบูรณ์ (Fragment) ได้

Pattern โดยรวม:

```text
[ของ] [ทำ] [เหตุผล]. [ขั้นต่อ].

```

## Pordee Stats

วิธีการเรียกดู:

```text
/pordee stats

```

หรือ:

```text
พอดีสถิติ

```

ตัวอย่าง Output:

```text
pordee stats
session: 14 active prompts, 3 toggles, est. 420 tokens saved
lifetime: 188 active prompts, 44 toggles, est. 6120 tokens saved
benchmark: lite 41% avg, full 68% avg across 3 built-in samples

```

ตัวเลขที่แสดงผลแบ่งออกเป็น 2 ประเภท:

- Counters ที่สามารถติดตามได้จริง เช่น Active Prompts, Toggles
- Estimated Token Savings ที่ประเมินจาก Built-in Benchmark Model

ข้อสำคัญ:

- จำนวน `tokens saved` ในขณะนี้เป็นเพียงการประเมิน (Estimated) เท่านั้น
- ยังไม่ใช่ข้อมูล Telemetry ที่แม่นยำจากทุกๆ Historical Reply

## โครงสร้าง Repository

| Path               | หน้าที่                                            |
| ------------------ | -------------------------------------------------- |
| `core/`            | Logic กลาง เช่น State, Triggers, Render, Stats     |
| `adapters/claude/` | Claude-specific integration                        |
| `adapters/codex/`  | Codex-specific integration                         |
| `plugins/pordee/`  | Packaged plugin surface สำหรับ Codex local install |
| `skills/pordee/`   | Canonical skill definition                         |
| `tools/`           | Installer / Backend tooling                        |
| `.claude-plugin/`  | Claude plugin manifests                            |
| `tests/`           | Regression tests                                   |

## ข้อจำกัด

- `Claude` และ `Codex` ยังคงมี Integration Surface ที่ไม่เหมือนกันในทุกจุด
- สถิติของ `pordee` ยังไม่ได้ดึงข้อมูล Token Usage จริงจากทุกการตอบกลับ
- Project-local Codex Plugin ในขณะนี้ยังคงเน้นไปที่ Packaged Skill/Plugin Surface มากกว่าการทำ Vendor Runtime ของ Repository ทั้งหมด

## License

MIT
