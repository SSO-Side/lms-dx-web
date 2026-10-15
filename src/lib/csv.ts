import { Role } from "@prisma/client";
import { z } from "zod";

export interface ParsedAccountRow {
  line: number;
  name: string;
  loginId: string;
  phone?: string;
  role: Role;
  error?: string;
}

export function parseCSVLines(text: string): string[][] {
  // BOM 제거
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n");
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let insideQuote = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          currentCell += '"';
          i++; // 이스케이프된 따옴표
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === "," && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }

  return result;
}

const roleMap: Record<string, Role> = {
  STUDENT: Role.STUDENT,
  수강생: Role.STUDENT,
  학생: Role.STUDENT,
  INSTRUCTOR: Role.INSTRUCTOR,
  강사: Role.INSTRUCTOR,
  교사: Role.INSTRUCTOR,
  MANAGER: Role.MANAGER,
  매니저: Role.MANAGER,
  담임: Role.MANAGER,
};

const rowSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요.").max(50),
  loginId: z
    .string()
    .min(3, "로그인ID는 3자 이상이어야 합니다.")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "로그인ID는 영문, 숫자, _, - 만 가능합니다."),
  phone: z.string().optional(),
  role: z.nativeEnum(Role, { message: "역할은 STUDENT, INSTRUCTOR, MANAGER 중 하나여야 합니다." }),
});

export function parseRosterCSV(csvText: string): {
  rows: ParsedAccountRow[];
  hasErrors: boolean;
} {
  const lines = parseCSVLines(csvText);
  if (lines.length < 2) {
    return {
      rows: [
        {
          line: 1,
          name: "",
          loginId: "",
          role: Role.STUDENT,
          error: "헤더와 최소 1개 이상의 데이터 행이 필요합니다.",
        },
      ],
      hasErrors: true,
    };
  }

  const header = lines[0].map((h) => h.trim());
  const nameIdx = header.findIndex((h) => h.includes("이름"));
  const loginIdIdx = header.findIndex((h) => h.includes("로그인ID") || h.includes("아이디"));
  const phoneIdx = header.findIndex((h) => h.includes("연락처") || h.includes("전화번호"));
  const roleIdx = header.findIndex((h) => h.includes("역할"));

  if (nameIdx === -1 || loginIdIdx === -1 || roleIdx === -1) {
    return {
      rows: [
        {
          line: 1,
          name: "",
          loginId: "",
          role: Role.STUDENT,
          error: "CSV 헤더에 '이름', '로그인ID', '역할' 열이 필수입니다.",
        },
      ],
      hasErrors: true,
    };
  }

  const seenLoginIds = new Set<string>();
  const rows: ParsedAccountRow[] = [];
  let hasErrors = false;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const name = raw[nameIdx] ?? "";
    const loginId = raw[loginIdIdx] ?? "";
    const phone = phoneIdx !== -1 ? raw[phoneIdx] : undefined;
    const rawRole = (raw[roleIdx] ?? "").toUpperCase();
    const mappedRole = roleMap[rawRole];

    const validation = rowSchema.safeParse({
      name,
      loginId,
      phone: phone || undefined,
      role: mappedRole,
    });

    let error: string | undefined;

    if (!validation.success) {
      error = validation.error.issues[0]?.message;
    } else if (seenLoginIds.has(loginId)) {
      error = `CSV 파일 내에 중복된 로그인ID('${loginId}')가 있습니다.`;
    }

    if (loginId) {
      seenLoginIds.add(loginId);
    }

    if (error) {
      hasErrors = true;
    }

    rows.push({
      line: lineNum,
      name,
      loginId,
      phone: phone || undefined,
      role: mappedRole ?? Role.STUDENT,
      error,
    });
  }

  return { rows, hasErrors };
}
