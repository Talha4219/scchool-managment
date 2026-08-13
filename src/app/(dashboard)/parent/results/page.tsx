"use client";

import { useEffect, useState } from "react";
import { getParentPortalData, type ParentPortalData } from "@/app/actions/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

function ScoreBadge({ score }: { score: number }) {
  const grade = score >= 90 ? { label: "A+", cls: "bg-green-100 text-green-700" }
    : score >= 80 ? { label: "A",  cls: "bg-green-100 text-green-700" }
    : score >= 70 ? { label: "B",  cls: "bg-blue-100 text-blue-700" }
    : score >= 60 ? { label: "C",  cls: "bg-amber-100 text-amber-700" }
    : { label: "F", cls: "bg-red-100 text-red-700" };

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
      </div>
      <span className="font-bold text-primary text-sm w-8">{score}</span>
      <Badge className={`${grade.cls} border-none text-xs px-1.5`}>{grade.label}</Badge>
    </div>
  );
}

export default function ParentResultsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParentPortalData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  const exams = data?.exams ?? [];
  const childName = data?.children[0]?.name ?? "";
  const childId = data?.children[0]?.id ?? "";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">{t("parentResults.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("parentResults.subtitle")}</p>
      </div>

      {exams.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            {t("parentResults.noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {exams.map(exam => {
            const result = exam.studentResults.find((sr: any) => sr.studentId === childId || sr.studentName === childName);
            return (
              <Card key={exam.id} className="border-none shadow-sm">
                <CardHeader className="pb-3 border-b border-secondary/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-primary">{exam.examName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{exam.subject} · {exam.className} · {exam.date}</p>
                    </div>
                    {result && <ScoreBadge score={result.score} />}
                  </div>
                </CardHeader>
                {result && (
                  <CardContent className="pt-4 space-y-3">
                    {result.detailedBreakdown && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t("parentResults.breakdown")}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{result.detailedBreakdown}</p>
                      </div>
                    )}
                    {result.recommendations && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">{t("parentResults.teacherRecommendations")}</p>
                        <p className="text-sm text-blue-800 leading-relaxed">{result.recommendations}</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
