"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchClassesDB, fetchClassBooksDB, uploadClassBookDB, deleteClassBookDB,
  fetchQuestionBankDB, generateQuestionsFromBookDB, updateQuestionBankItemDB, deleteQuestionBankItemDB,
  addQuestionBankItemsToOnlineExamDB, type ClassBook, type QuestionBankItem,
} from "@/app/actions/academic-core";
import { fetchOnlineExamsDB } from "@/app/actions/features";
import { BookOpen, Upload, Trash2, Sparkles, Loader2, Check, Pencil, Plus, X } from "lucide-react";
import type { ClassItem, OnlineExam } from "@/lib/types";

export default function BookLibraryPage() {
  const { can, loaded: permsLoaded } = usePermission();
  const { subjects } = useAppState();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [books, setBooks] = useState<ClassBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ classId: "", subjectId: "", title: "", author: "", fileName: "", pdfData: "" });
  const [uploading, setUploading] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genBook, setGenBook] = useState<ClassBook | null>(null);
  const [genParams, setGenParams] = useState({ topicHint: "", mcqCount: 5, shortAnswerCount: 3, difficulty: "Medium" as "Easy" | "Medium" | "Hard" });
  const [generating, setGenerating] = useState(false);

  const [bankOpen, setBankOpen] = useState(false);
  const [bankBook, setBankBook] = useState<ClassBook | null>(null);
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [onlineExams, setOnlineExams] = useState<OnlineExam[]>([]);
  const [addToExamId, setAddToExamId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cls, bks] = await Promise.all([fetchClassesDB(), fetchClassBooksDB()]);
    setClasses(cls);
    setBooks(bks);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // base64 encoding inflates size ~33% — a raw file over ~7MB pushes the
    // encoded server-action payload past the 10MB request limit.
    const MAX_FILE_BYTES = 7 * 1024 * 1024;
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "PDF is too large", description: "Please upload a file under 7MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadForm(f => ({ ...f, fileName: file.name, pdfData: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!uploadForm.classId || !uploadForm.title || !uploadForm.pdfData) {
      toast({ title: "Class, title, and a PDF file are required", variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const res = await uploadClassBookDB({
        classId: uploadForm.classId, subjectId: uploadForm.subjectId || null, title: uploadForm.title,
        author: uploadForm.author, fileName: uploadForm.fileName, pdfData: uploadForm.pdfData,
      });
      if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
      toast({ title: "Book uploaded" });
      setUploadOpen(false);
      setUploadForm({ classId: "", subjectId: "", title: "", author: "", fileName: "", pdfData: "" });
      load();
    } catch {
      // The server action call itself throws (rather than returning
      // {error}) when the request is rejected before reaching our code —
      // e.g. exceeding Next.js's server-action body size limit.
      toast({ title: "Upload failed", description: "The file may be too large or the connection was interrupted. Please try a smaller PDF.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (book: ClassBook) => {
    const ok = await confirm({ title: `Delete "${book.title}"?`, description: "This removes the book from the library. Existing AI-generated questions from it are kept." });
    if (!ok) return;
    const res = await deleteClassBookDB(book.id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Book removed" });
    load();
  };

  const openGenerate = (book: ClassBook) => {
    setGenBook(book);
    setGenParams({ topicHint: "", mcqCount: 5, shortAnswerCount: 3, difficulty: "Medium" });
    setGenOpen(true);
  };

  const handleGenerate = async () => {
    if (!genBook) return;
    setGenerating(true);
    const res = await generateQuestionsFromBookDB(genBook.id, genParams);
    setGenerating(false);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Generated ${res.count} question(s) — review them below.` });
    setGenOpen(false);
    openBank(genBook);
  };

  const openBank = async (book: ClassBook) => {
    setBankBook(book);
    setSelectedItems(new Set());
    setBankOpen(true);
    const [items, exams] = await Promise.all([fetchQuestionBankDB(book.id), fetchOnlineExamsDB()]);
    setBankItems(items);
    setOnlineExams(exams.filter(e => e.status === "Draft"));
  };

  const reloadBank = async () => {
    if (!bankBook) return;
    setBankItems(await fetchQuestionBankDB(bankBook.id));
  };

  const handleApprove = async (item: QuestionBankItem) => {
    await updateQuestionBankItemDB(item.id, { status: "approved" });
    reloadBank();
  };

  const handleDeleteItem = async (item: QuestionBankItem) => {
    await deleteQuestionBankItemDB(item.id);
    reloadBank();
  };

  const handleEditText = async (item: QuestionBankItem, text: string) => {
    await updateQuestionBankItemDB(item.id, { questionText: text });
    reloadBank();
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddToExam = async () => {
    if (!addToExamId || selectedItems.size === 0) {
      toast({ title: "Select an exam and at least one approved question", variant: "destructive" }); return;
    }
    const res = await addQuestionBankItemsToOnlineExamDB(addToExamId, [...selectedItems]);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: `Added ${res.count} question(s) to the exam` });
    setSelectedItems(new Set());
  };

  const filteredBooks = classFilter === "all" ? books : books.filter(b => b.classId === classFilter);

  if (!permsLoaded) return null;
  if (!can("exams.books")) return <Unauthorized />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="dashboard-heading !text-2xl">Book Library &amp; AI Question Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload class textbooks, then generate MCQs/short-answer questions from them with AI</p>
        </div>
        <div className="flex gap-2">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1.5" /> Upload Book</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filteredBooks.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          No books uploaded yet.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredBooks.map(book => (
            <Card key={book.id} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> {book.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{book.className}{book.subjectName ? ` · ${book.subjectName}` : ""}</p>
                {book.author && <p className="text-xs text-muted-foreground">by {book.author}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1" onClick={() => openGenerate(book)}><Sparkles className="h-3.5 w-3.5 mr-1" /> AI Generate</Button>
                  <Button size="sm" variant="outline" onClick={() => openBank(book)}>Question Bank</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(book)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Class Book</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Class *</Label>
                <Select value={uploadForm.classId} onValueChange={v => setUploadForm(f => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject (optional)</Label>
                <Select value={uploadForm.subjectId} onValueChange={v => setUploadForm(f => ({ ...f, subjectId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Whole class" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title *</Label><Input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Physics Grade 9" /></div>
            <div><Label>Author</Label><Input value={uploadForm.author} onChange={e => setUploadForm(f => ({ ...f, author: e.target.value }))} /></div>
            <div>
              <Label>PDF File *</Label>
              <Input type="file" accept="application/pdf" onChange={handleFileChange} />
              {uploadForm.fileName && <p className="text-xs text-muted-foreground mt-1">Selected: {uploadForm.fileName}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Questions — {genBook?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Topic / Chapter (optional)</Label><Input value={genParams.topicHint} onChange={e => setGenParams(p => ({ ...p, topicHint: e.target.value }))} placeholder="Leave blank to draw from the whole book" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>MCQs</Label><Input type="number" min={0} max={30} value={genParams.mcqCount} onChange={e => setGenParams(p => ({ ...p, mcqCount: Number(e.target.value) }))} /></div>
              <div><Label>Short Answer</Label><Input type="number" min={0} max={30} value={genParams.shortAnswerCount} onChange={e => setGenParams(p => ({ ...p, shortAnswerCount: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={genParams.difficulty} onValueChange={(v: any) => setGenParams(p => ({ ...p, difficulty: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Questions are generated as drafts — review and approve them before they can be added to an exam.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Bank Dialog */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Question Bank — {bankBook?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {bankItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No questions yet — use AI Generate to create some.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Select value={addToExamId} onValueChange={setAddToExamId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Add selected approved questions to a draft online exam" /></SelectTrigger>
                    <SelectContent>{onlineExams.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddToExam} disabled={selectedItems.size === 0 || !addToExamId}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add ({selectedItems.size})
                  </Button>
                </div>
                {bankItems.map(item => (
                  <Card key={item.id} className="border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {item.status === "approved" && (
                            <input type="checkbox" className="mt-1" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                          )}
                          <Textarea
                            className="text-sm min-h-[50px]"
                            value={item.questionText}
                            onChange={e => setBankItems(items => items.map(i => i.id === item.id ? { ...i, questionText: e.target.value } : i))}
                            onBlur={e => handleEditText(item, e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Badge variant={item.status === "approved" ? "default" : "secondary"} className="text-[10px]">{item.status}</Badge>
                          <Badge variant="outline" className="text-[10px]">{item.questionType}</Badge>
                        </div>
                      </div>
                      {item.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {item.options.map((opt, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded border ${opt === item.correctAnswer ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-border"}`}>{opt}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end gap-1.5">
                        {item.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => handleApprove(item)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteItem(item)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
