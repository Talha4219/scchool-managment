"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2, MessageSquare, User, Lock } from "lucide-react";
import { generateParentProgressReport } from "@/ai/flows/generate-parent-progress-report";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";

export default function CommunicationsPage() {
  const { students, attendance, exams, addNotification, activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [selectedStudentId, setSelectedStudentId] = useState("s1"); // Alexander Sterling
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [teacherComments, setTeacherComments] = useState(
    "Alexander has shown great enthusiasm in history projects but needs to focus more on calculus homework."
  );

  const [studentDetails, setStudentDetails] = useState<any>(null);

  if (activeRole !== "ADMIN" && activeRole !== "TEACHER") {
    if (!permsLoaded) return null;
  if (!can("communications.view")) return <Unauthorized />;

  return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-700 rounded-full">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-primary">Access Restricted</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          AI Communications suite is only available to instructors and administrators.
        </p>
      </div>
    );
  }

  // Load selected student dynamic stats
  useEffect(() => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Calculate attendance records dynamically
    const studentLogs = attendance.filter(a => a.studentId === student.id);
    const absentDays = studentLogs.filter(a => a.status === "Absent").length;
    const tardyDays = studentLogs.filter(a => a.status === "Late").length;
    const totalDays = studentLogs.length || 30; // fallback default

    // Gather academic performance from exams
    const subjectGrades: Record<string, string> = {};
    
    // Seed default grades if no exams are registered yet
    subjectGrades["Mathematics"] = "B+";
    subjectGrades["Science"] = "A-";
    subjectGrades["English"] = "A";

    // Layer actual graded results
    exams.forEach(ex => {
      const match = ex.studentResults.find(r => r.studentId === student.id);
      if (match) {
        let letterGrade = "B";
        if (match.score >= 90) letterGrade = "A";
        else if (match.score >= 80) letterGrade = "B+";
        else if (match.score >= 70) letterGrade = "C";
        else letterGrade = "D";
        
        subjectGrades[ex.subject] = letterGrade;
      }
    });

    const academicPerformance = Object.entries(subjectGrades).map(([subject, grade]) => ({
      subject,
      grade
    }));

    setStudentDetails({
      student,
      academicPerformance,
      attendanceRecord: {
        totalDays,
        absentDays,
        tardyDays
      }
    });
  }, [selectedStudentId, students, attendance, exams]);

  const handleGenerate = async () => {
    if (!studentDetails) return;
    setLoading(true);
    try {
      const result = await generateParentProgressReport({
        studentName: studentDetails.student.name,
        className: `${studentDetails.student.class}-${studentDetails.student.section}`,
        teacherName: "Ms. Sarah Harrison",
        teacherComments,
        academicPerformance: studentDetails.academicPerformance,
        attendanceRecord: studentDetails.attendanceRecord
      });
      
      setReport(result.reportMessage);
      toast({ 
        title: "Draft Created", 
        description: "AI progress report summary generated." 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Could not connect with generative services.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!studentDetails || !report) return;

    addNotification(
      "Academic Progress Report",
      report,
      "PARENT",
      studentDetails.student.parentEmail
    );

    toast({
      title: "Circular Sent",
      description: `Report successfully dispatched to parent ${studentDetails.student.parentName}`,
    });

    setReport("");
  };

  // Only display active students
  const activeStudents = students.filter(s => s.status === "Active");

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">AI Communication Assistant</h1>
        <p className="text-muted-foreground mt-1">Draft and send personalized parent updates using dynamic student reports.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-2 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Report Parameters</CardTitle>
            <CardDescription>Select student profile and configure settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentSelect">Select Student Record</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger id="studentSelect">
                  <SelectValue placeholder="Select Student" />
                </SelectTrigger>
                <SelectContent>
                  {activeStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.class}-{s.section})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {studentDetails && (
              <div className="p-3 bg-secondary/20 rounded-lg text-xs space-y-1 font-semibold text-primary border">
                <p className="font-bold flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Compiled Dossier:
                </p>
                <div className="pl-4 text-muted-foreground space-y-0.5">
                  <p>Grades: {studentDetails.academicPerformance.map((a: any) => `${a.subject}: ${a.grade}`).join(", ")}</p>
                  <p>Attendance Days: {studentDetails.attendanceRecord.totalDays} (Absences: {studentDetails.attendanceRecord.absentDays})</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments">Supplementary Observations</Label>
              <Textarea 
                id="comments" 
                placeholder="Key strengths, focus points, or classroom attitude..."
                className="min-h-[140px]"
                value={teacherComments}
                onChange={(e) => setTeacherComments(e.target.value)}
              />
            </div>
            <Button 
              className="w-full bg-accent hover:bg-accent/90 gap-2 mt-4 text-white font-bold" 
              onClick={handleGenerate}
              disabled={loading || !studentDetails}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
              Generate AI Report Draft
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm flex flex-col min-h-[460px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Drafted Message</CardTitle>
              <CardDescription>Professional notification summary</CardDescription>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 min-h-[300px] p-4 bg-secondary/15 rounded-lg border-2 border-dashed border-secondary text-xs font-medium leading-relaxed whitespace-pre-wrap italic text-slate-800">
              {report || "Select parameters and click generate. The drafted letter will appear here..."}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1 font-semibold" disabled={!report} onClick={() => setReport("")}>
                Clear Draft
              </Button>
              <Button onClick={handleSend} className="flex-1 bg-primary gap-2 text-white font-bold shadow-sm" disabled={!report}>
                <Send className="h-4 w-4" /> Dispatch to Parent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
