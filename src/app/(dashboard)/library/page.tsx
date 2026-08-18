"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { LibraryBook, BookIssue } from "@/lib/types";
import {
  fetchLibraryBooksDB, createLibraryBookDB, deleteLibraryBookDB,
  fetchBookIssuesDB, issueBookDB, returnBookDB, payBookFineDB,
} from "@/app/actions/features";
import {
  Plus, Search, BookOpen, BookMarked, BookX, Edit, Trash2,
  Library, ListChecks, ArrowLeftRight, AlertTriangle, DollarSign,
  CheckCircle, XCircle, Clock, Loader2, Lock, Calendar,
} from "lucide-react";

const bookCategories = ["Fiction", "Non-Fiction", "Academic", "Reference", "Science", "History", "Literature", "Mathematics", "Computer Science", "Arts"];

const blankBook: Omit<LibraryBook, "id"> = {
  title: "", author: "", isbn: "", category: "Academic", publisher: "", publishYear: new Date().getFullYear(),
  totalCopies: 1, availableCopies: 1, rackNumber: "", barcode: "", isDigital: false, digitalUrl: "", status: "Available",
};

export default function LibraryPage() {
  const { activeRole } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("catalog");

  const [createOpen, setCreateOpen] = useState(false);
  const [bookForm, setBookForm] = useState(blankBook);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueBookId, setIssueBookId] = useState("");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueDueDate, setIssueDueDate] = useState("");

  const isLibrarian = (activeRole === "ADMIN" || activeRole === "PRINCIPAL") || activeRole === "TEACHER";
  const isStudent = activeRole === "STUDENT";

  const loadData = async () => {
    setLoading(true);
    const [booksData, issuesData] = await Promise.all([
      fetchLibraryBooksDB(),
      isStudent ? fetchBookIssuesDB(students[0]?.id) : fetchBookIssuesDB(),
    ]);
    setBooks(booksData);
    setIssues(issuesData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredBooks = books.filter(b => {
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q);
  });

  const totalAvailable = books.filter(b => b.status === "Available" && b.availableCopies > 0).length;
  const totalIssued = issues.filter(i => i.status === "Issued" || i.status === "Overdue").length;
  const overdueCount = issues.filter(i => i.status === "Overdue" || (i.status === "Issued" && new Date(i.dueDate) < new Date())).length;

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.title || !bookForm.author) {
      toast({ title: "Title and Author are required.", variant: "destructive" });
      return;
    }
    const res = await createLibraryBookDB(bookForm);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Book added to library." });
    setCreateOpen(false);
    setBookForm(blankBook);
    loadData();
  };

  const handleDeleteBook = async (id: string) => {
    const res = await deleteLibraryBookDB(id);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Book removed." });
    loadData();
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBookId || !issueStudentId || !issueDueDate) {
      toast({ title: "Book, Student, and Due Date are required.", variant: "destructive" });
      return;
    }
    const student = students.find(s => s.id === issueStudentId);
    if (!student) { toast({ title: "Student not found.", variant: "destructive" }); return; }
    const res = await issueBookDB(issueBookId, student.id, student.name, issueDueDate);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Book issued successfully." });
    setIssueOpen(false);
    setIssueBookId("");
    setIssueStudentId("");
    setIssueDueDate("");
    loadData();
  };

  const handleReturnBook = async (issueId: string) => {
    const res = await returnBookDB(issueId);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Book returned." });
    loadData();
  };

  const handlePayFine = async (issueId: string) => {
    const res = await payBookFineDB(issueId);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Fine paid successfully." });
    loadData();
  };

  if (!permsLoaded) return null;
  if (!can("library.view")) return <Unauthorized />;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl border">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Title", "Author", "Category", "Status"].map(h => <TableHead key={h}>{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isStudent) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Library</h1>
          <p className="text-muted-foreground mt-1">Browse books and view your issued books</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
            <p className="text-xs font-semibold text-blue-600">Available Books</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalAvailable}</p>
          </div>
          <div className="p-4 rounded-xl border bg-amber-50 border-amber-100">
            <p className="text-xs font-semibold text-amber-600">My Issued Books</p>
            <p className="text-2xl font-bold text-primary mt-1">{issues.filter(i => i.status === "Issued").length}</p>
          </div>
          <div className="p-4 rounded-xl border bg-red-50 border-red-100">
            <p className="text-xs font-semibold text-red-600">Overdue</p>
            <p className="text-2xl font-bold text-primary mt-1">{issues.filter(i => i.status === "Overdue").length}</p>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catalog" className="gap-2"><BookOpen className="h-4 w-4" /> Book Catalog</TabsTrigger>
            <TabsTrigger value="myissues" className="gap-2"><ListChecks className="h-4 w-4" /> My Issued Books</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <BookMarked className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Book Catalog</CardTitle>
                  <div className="relative ml-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by title, author or ISBN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-72" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead className="font-bold">Title</TableHead>
                        <TableHead className="font-bold">Author</TableHead>
                        <TableHead className="font-bold">ISBN</TableHead>
                        <TableHead className="font-bold">Category</TableHead>
                        <TableHead className="font-bold text-center">Copies</TableHead>
                        <TableHead className="font-bold text-center">Available</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBooks.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No books found.</TableCell></TableRow>
                      ) : filteredBooks.map(book => (
                        <TableRow key={book.id} className="hover:bg-secondary/5">
                          <TableCell className="font-semibold text-primary">{book.title}</TableCell>
                          <TableCell className="text-muted-foreground">{book.author}</TableCell>
                          <TableCell className="font-mono text-xs">{book.isbn}</TableCell>
                          <TableCell><Badge className="bg-purple-50 text-purple-700 border-0">{book.category}</Badge></TableCell>
                          <TableCell className="text-center">{book.totalCopies}</TableCell>
                          <TableCell className="text-center">{book.availableCopies}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              book.status === "Available" ? "bg-green-100 text-green-700 border-0" :
                              book.status === "Issued" ? "bg-amber-100 text-amber-700 border-0" :
                              book.status === "Reserved" ? "bg-blue-100 text-blue-700 border-0" :
                              "bg-red-100 text-red-700 border-0"
                            }>
                              {book.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="myissues">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">My Issued Books</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead className="font-bold">Book</TableHead>
                        <TableHead className="font-bold">Issued Date</TableHead>
                        <TableHead className="font-bold">Due Date</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                        <TableHead className="font-bold text-right">Fine</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No books issued.</TableCell></TableRow>
                      ) : issues.map(issue => (
                        <TableRow key={issue.id} className="hover:bg-secondary/5">
                          <TableCell className="font-semibold text-primary">{issue.bookTitle}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{issue.issuedDate}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{issue.dueDate}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              issue.status === "Issued" ? "bg-blue-100 text-blue-700 border-0" :
                              issue.status === "Returned" ? "bg-green-100 text-green-700 border-0" :
                              "bg-red-100 text-red-700 border-0"
                            }>
                              {issue.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {issue.fine > 0 ? (
                              <span className={`font-semibold ${issue.finePaid ? "text-green-600" : "text-red-600"}`}>
                                ${issue.fine} {issue.finePaid ? "(Paid)" : ""}
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (!isLibrarian) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold text-primary">Access Restricted</h2>
      </div>
    );
  }

  const pendingIssues = issues.filter(i => i.status === "Issued" && new Date(i.dueDate) >= new Date());
  const returnedIssues = issues.filter(i => i.status === "Returned");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Library Management</h1>
          <p className="text-muted-foreground mt-1">Manage books catalog, issues, and returns</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><ArrowLeftRight className="h-4 w-4" /> Issue Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Issue Book to Student</DialogTitle></DialogHeader>
              <form onSubmit={handleIssueBook} className="space-y-4 py-2">
                <div className="space-y-1"><Label>Book *</Label>
                  <Select value={issueBookId} onValueChange={setIssueBookId}>
                    <SelectTrigger><SelectValue placeholder="Select book" /></SelectTrigger>
                    <SelectContent>
                      {books.filter(b => b.availableCopies > 0).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.title} ({b.availableCopies} avail.)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Student *</Label>
                  <Select value={issueStudentId} onValueChange={setIssueStudentId}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>
                      {students.filter(s => s.status === "Active").map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — {s.class} {s.section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Due Date *</Label><Input type="date" value={issueDueDate} onChange={e => setIssueDueDate(e.target.value)} /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
                  <Button type="submit">Issue Book</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Book</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateBook} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Title *</Label><Input value={bookForm.title} onChange={e => setBookForm(f => ({...f, title: e.target.value}))} placeholder="e.g. The Great Gatsby" /></div>
                  <div className="space-y-1"><Label>Author *</Label><Input value={bookForm.author} onChange={e => setBookForm(f => ({...f, author: e.target.value}))} placeholder="e.g. F. Scott Fitzgerald" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>ISBN</Label><Input value={bookForm.isbn} onChange={e => setBookForm(f => ({...f, isbn: e.target.value}))} placeholder="978-3-16-148410-0" /></div>
                  <div className="space-y-1"><Label>Category</Label>
                    <Select value={bookForm.category} onValueChange={v => setBookForm(f => ({...f, category: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {bookCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Publisher</Label><Input value={bookForm.publisher} onChange={e => setBookForm(f => ({...f, publisher: e.target.value}))} placeholder="Publisher name" /></div>
                  <div className="space-y-1"><Label>Publish Year</Label><Input type="number" min={1900} max={2030} value={bookForm.publishYear} onChange={e => setBookForm(f => ({...f, publishYear: parseInt(e.target.value) || new Date().getFullYear()}))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Total Copies</Label><Input type="number" min={1} value={bookForm.totalCopies} onChange={e => { const v = parseInt(e.target.value) || 1; setBookForm(f => ({...f, totalCopies: v, availableCopies: v})); }} /></div>
                  <div className="space-y-1"><Label>Rack No.</Label><Input value={bookForm.rackNumber} onChange={e => setBookForm(f => ({...f, rackNumber: e.target.value}))} placeholder="A-12" /></div>
                  <div className="space-y-1"><Label>Barcode</Label><Input value={bookForm.barcode} onChange={e => setBookForm(f => ({...f, barcode: e.target.value}))} placeholder="BC-001" /></div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Book</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
          <p className="text-xs font-semibold text-blue-600">Total Books</p>
          <p className="text-2xl font-bold text-primary mt-1">{books.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-green-50 border-green-100">
          <p className="text-xs font-semibold text-green-600">Available</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalAvailable}</p>
        </div>
        <div className="p-4 rounded-xl border bg-amber-50 border-amber-100">
          <p className="text-xs font-semibold text-amber-600">Issued</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalIssued}</p>
        </div>
        <div className="p-4 rounded-xl border bg-red-50 border-red-100">
          <p className="text-xs font-semibold text-red-600">Overdue</p>
          <p className="text-2xl font-bold text-primary mt-1">{overdueCount}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalog" className="gap-2"><BookOpen className="h-4 w-4" /> Books Catalog</TabsTrigger>
          <TabsTrigger value="issues" className="gap-2"><ArrowLeftRight className="h-4 w-4" /> Issue / Return</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Library className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">All Books</CardTitle>
                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by title, author or ISBN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-72" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead className="font-bold">Title</TableHead>
                      <TableHead className="font-bold">Author</TableHead>
                      <TableHead className="font-bold">ISBN</TableHead>
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="font-bold text-center">Total</TableHead>
                      <TableHead className="font-bold text-center">Available</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBooks.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No books found.</TableCell></TableRow>
                    ) : filteredBooks.map(book => (
                      <TableRow key={book.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary">{book.title}</TableCell>
                        <TableCell className="text-muted-foreground">{book.author}</TableCell>
                        <TableCell className="font-mono text-xs">{book.isbn || "—"}</TableCell>
                        <TableCell><Badge className="bg-purple-50 text-purple-700 border-0">{book.category}</Badge></TableCell>
                        <TableCell className="text-center">{book.totalCopies}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${book.availableCopies === 0 ? "text-red-600" : "text-green-600"}`}>
                            {book.availableCopies}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            book.status === "Available" ? "bg-green-100 text-green-700 border-0" :
                            book.status === "Issued" ? "bg-amber-100 text-amber-700 border-0" :
                            book.status === "Reserved" ? "bg-blue-100 text-blue-700 border-0" :
                            "bg-red-100 text-red-700 border-0"
                          }>{book.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Book</AlertDialogTitle>
                                <AlertDialogDescription>Remove "{book.title}" from the library? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteBook(book.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
                <p className="text-xs font-semibold text-blue-600">Currently Issued</p>
                <p className="text-2xl font-bold text-primary mt-1">{pendingIssues.length}</p>
              </div>
              <div className="p-4 rounded-xl border bg-green-50 border-green-100">
                <p className="text-xs font-semibold text-green-600">Returned</p>
                <p className="text-2xl font-bold text-primary mt-1">{returnedIssues.length}</p>
              </div>
              <div className="p-4 rounded-xl border bg-red-50 border-red-100">
                <p className="text-xs font-semibold text-red-600">Overdue</p>
                <p className="text-2xl font-bold text-primary mt-1">{overdueCount}</p>
              </div>
            </div>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Issue / Return Records</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead className="font-bold">Book</TableHead>
                        <TableHead className="font-bold">Student</TableHead>
                        <TableHead className="font-bold">Issued</TableHead>
                        <TableHead className="font-bold">Due Date</TableHead>
                        <TableHead className="font-bold">Returned</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                        <TableHead className="font-bold text-right">Fine</TableHead>
                        <TableHead className="w-32 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No issue records found.</TableCell></TableRow>
                      ) : issues.map(issue => (
                        <TableRow key={issue.id} className="hover:bg-secondary/5">
                          <TableCell className="font-semibold text-primary">{issue.bookTitle}</TableCell>
                          <TableCell className="text-muted-foreground">{issue.studentName}</TableCell>
                          <TableCell className="text-sm">{issue.issuedDate}</TableCell>
                          <TableCell className="text-sm">{issue.dueDate}</TableCell>
                          <TableCell className="text-sm">{issue.returnedDate || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              issue.status === "Issued" ? "bg-blue-100 text-blue-700 border-0" :
                              issue.status === "Returned" ? "bg-green-100 text-green-700 border-0" :
                              "bg-red-100 text-red-700 border-0"
                            }>{issue.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {issue.fine > 0 ? (
                              <span className={`font-semibold ${issue.finePaid ? "text-green-600" : "text-red-600"}`}>
                                ${issue.fine}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              {(issue.status === "Issued" || issue.status === "Overdue") && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleReturnBook(issue.id)}>
                                  <CheckCircle className="h-3 w-3" /> Return
                                </Button>
                              )}
                              {issue.fine > 0 && !issue.finePaid && issue.status === "Returned" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-600" onClick={() => handlePayFine(issue.id)}>
                                  <DollarSign className="h-3 w-3" /> Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
