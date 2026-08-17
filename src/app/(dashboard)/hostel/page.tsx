"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { useStudents } from "@/lib/students-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import {
  fetchHostelsDB, createHostelDB, fetchHostelRoomsDB, createHostelRoomDB,
  allocateHostelDB, fetchHostelAllocationsDB,
} from "@/app/actions/features";
import type { Hostel, HostelRoom, HostelAllocation } from "@/lib/types";
import {
  Building2, Bed, UserCheck, Plus, Pencil, X, Trash2, Users, Phone,
  MapPin, Home, Eye, RefreshCw, BookOpen, DoorOpen, DollarSign,
} from "lucide-react";

export default function HostelPage() {
  const { schoolInfo } = useAppState();
  const { students } = useStudents();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [loading, setLoading] = useState(true);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>("");

  const [hostelDialog, setHostelDialog] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [hostelForm, setHostelForm] = useState({ name: "", type: "Boys", wardenName: "", contactPhone: "", totalRooms: "", totalBeds: "", address: "" });

  const [roomDialog, setRoomDialog] = useState(false);
  const [roomForm, setRoomForm] = useState({ hostelId: "", roomNumber: "", floor: "", totalBeds: "", monthlyFee: "", isActive: true });

  const [allocateDialog, setAllocateDialog] = useState(false);
  const [allocateForm, setAllocateForm] = useState({ hostelId: "", roomId: "", studentId: "", feeAmount: "", feePaid: false, startDate: new Date().toISOString().split("T")[0], endDate: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        fetchHostelsDB(),
        fetchHostelAllocationsDB(),
      ]);
      setHostels(h);
      setAllocations(a);
      if (h.length > 0 && !selectedHostelId) setSelectedHostelId(h[0].id);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedHostelId) { setRooms([]); return; }
    fetchHostelRoomsDB(selectedHostelId).then(setRooms);
  }, [selectedHostelId]);

  const selectedHostel = hostels.find(h => h.id === selectedHostelId);
  const hostelRooms = selectedHostelId ? rooms : [];
  const hostelAllocations = selectedHostelId ? allocations.filter(a => a.hostelId === selectedHostelId) : [];

  const totalBeds = hostels.reduce((s, h) => s + h.totalBeds, 0);
  const totalRooms = hostels.reduce((s, h) => s + h.totalRooms, 0);
  const occupiedBeds = allocations.filter(a => a.status === "Active").length;
  const availableBeds = totalBeds - occupiedBeds;

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";

  const openAddHostel = () => {
    setEditingHostel(null);
    setHostelForm({ name: "", type: "Boys", wardenName: "", contactPhone: "", totalRooms: "", totalBeds: "", address: "" });
    setHostelDialog(true);
  };

  const openEditHostel = (h: Hostel) => {
    setEditingHostel(h);
    setHostelForm({ name: h.name, type: h.type, wardenName: h.wardenName, contactPhone: h.contactPhone, totalRooms: String(h.totalRooms), totalBeds: String(h.totalBeds), address: h.address });
    setHostelDialog(true);
  };

  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelForm.name.trim()) { toast({ title: "Validation Error", description: "Hostel name is required.", variant: "destructive" }); return; }
    if (editingHostel) {
      setHostels(prev => prev.map(h => h.id === editingHostel.id ? { ...h, name: hostelForm.name, type: hostelForm.type as Hostel["type"], wardenName: hostelForm.wardenName, contactPhone: hostelForm.contactPhone, totalRooms: Number(hostelForm.totalRooms), totalBeds: Number(hostelForm.totalBeds), address: hostelForm.address } : h));
      toast({ title: "Hostel Updated", description: `"${hostelForm.name}" saved.` });
    } else {
      const res = await createHostelDB({ name: hostelForm.name.trim(), type: hostelForm.type as Hostel["type"], wardenName: hostelForm.wardenName, contactPhone: hostelForm.contactPhone, totalRooms: Number(hostelForm.totalRooms), totalBeds: Number(hostelForm.totalBeds), address: hostelForm.address });
      if (res.id) {
        setHostels(prev => [...prev, { id: res.id!, name: hostelForm.name.trim(), type: hostelForm.type as Hostel["type"], wardenName: hostelForm.wardenName, contactPhone: hostelForm.contactPhone, totalRooms: Number(hostelForm.totalRooms), totalBeds: Number(hostelForm.totalBeds), address: hostelForm.address }]);
        toast({ title: "Hostel Created", description: `"${hostelForm.name}" added.` });
      } else { toast({ title: "Error", description: res.error || "Failed.", variant: "destructive" }); }
    }
    setHostelDialog(false);
  };

  const openAddRoom = () => {
    setRoomForm({ hostelId: selectedHostelId, roomNumber: "", floor: "1", totalBeds: "", monthlyFee: "", isActive: true });
    setRoomDialog(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.roomNumber.trim()) { toast({ title: "Validation Error", description: "Room number is required.", variant: "destructive" }); return; }
    const res = await createHostelRoomDB({ hostelId: roomForm.hostelId, roomNumber: roomForm.roomNumber.trim(), floor: Number(roomForm.floor), totalBeds: Number(roomForm.totalBeds), occupiedBeds: 0, monthlyFee: Number(roomForm.monthlyFee), isActive: roomForm.isActive });
    if (res.id) {
      setRooms(prev => [...prev, { id: res.id!, hostelId: roomForm.hostelId, roomNumber: roomForm.roomNumber.trim(), floor: Number(roomForm.floor), totalBeds: Number(roomForm.totalBeds), occupiedBeds: 0, monthlyFee: Number(roomForm.monthlyFee), isActive: roomForm.isActive }]);
      setHostels(prev => prev.map(h => h.id === selectedHostelId ? { ...h, totalRooms: h.totalRooms + 1, totalBeds: h.totalBeds + Number(roomForm.totalBeds) } : h));
      toast({ title: "Room Added", description: `Room ${roomForm.roomNumber} created.` });
    } else { toast({ title: "Error", description: res.error || "Failed.", variant: "destructive" }); }
    setRoomDialog(false);
  };

  const openAllocate = () => {
    setAllocateForm({ hostelId: selectedHostelId, roomId: "", studentId: "", feeAmount: "", feePaid: false, startDate: new Date().toISOString().split("T")[0], endDate: "" });
    setAllocateDialog(true);
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateForm.roomId || !allocateForm.studentId) { toast({ title: "Validation Error", description: "Select room and student.", variant: "destructive" }); return; }
    const room = rooms.find(r => r.id === allocateForm.roomId);
    if (room && room.occupiedBeds >= room.totalBeds) { toast({ title: "Room Full", description: "No beds available in this room.", variant: "destructive" }); return; }
    const student = students.find(s => s.id === allocateForm.studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    const hostel = hostels.find(h => h.id === allocateForm.hostelId);
    const res = await allocateHostelDB({
      hostelId: allocateForm.hostelId, hostelName: hostel?.name || "", roomId: allocateForm.roomId,
      roomNumber: room?.roomNumber || "", studentId: student.id, studentName: student.name,
      startDate: allocateForm.startDate, endDate: allocateForm.endDate,
      status: "Active", feeAmount: Number(allocateForm.feeAmount), feePaid: allocateForm.feePaid,
    });
    if (!res.error) {
      setRooms(prev => prev.map(r => r.id === allocateForm.roomId ? { ...r, occupiedBeds: r.occupiedBeds + 1 } : r));
      setAllocations(prev => [{
        id: `ha_${Date.now()}`, hostelId: allocateForm.hostelId, hostelName: hostel?.name || "",
        roomId: allocateForm.roomId, roomNumber: room?.roomNumber || "",
        studentId: student.id, studentName: student.name,
        startDate: allocateForm.startDate, endDate: allocateForm.endDate,
        status: "Active", feeAmount: Number(allocateForm.feeAmount), feePaid: allocateForm.feePaid,
      }, ...prev]);
      toast({ title: "Allocated", description: `${student.name} assigned to Room ${room?.roomNumber}.` });
    } else { toast({ title: "Error", description: res.error, variant: "destructive" }); }
    setAllocateDialog(false);
  };

  const roomStatus = (room: HostelRoom) => {
    if (!room.isActive) return <Badge className="bg-gray-100 text-gray-600 border-0">Inactive</Badge>;
    if (room.occupiedBeds >= room.totalBeds) return <Badge className="bg-red-100 text-red-700 border-0">Full</Badge>;
    if (room.occupiedBeds > 0) return <Badge className="bg-amber-100 text-amber-700 border-0">Partial</Badge>;
    return <Badge className="bg-green-100 text-green-700 border-0">Available</Badge>;
  };

  if (!permsLoaded) return null;
  if (!can("hostel.view")) return <Unauthorized />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Hostel Management</h1>
          <p className="text-muted-foreground mt-1">Manage hostels, rooms, allocations, and visitor logs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={loadData}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Dialog open={hostelDialog} onOpenChange={setHostelDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={openAddHostel}>
                <Plus className="h-4 w-4" /> Add Hostel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-secondary">
              <form onSubmit={handleSaveHostel}>
                <DialogHeader>
                  <DialogTitle className="font-headline font-bold text-primary">{editingHostel ? "Edit Hostel" : "Add New Hostel"}</DialogTitle>
                  <DialogDescription>Register or update hostel details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hostel Name</Label>
                      <Input value={hostelForm.name} onChange={e => setHostelForm({ ...hostelForm, name: e.target.value })} placeholder="e.g. Sunshine Hostel" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={hostelForm.type} onValueChange={v => setHostelForm({ ...hostelForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Boys">Boys</SelectItem>
                          <SelectItem value="Girls">Girls</SelectItem>
                          <SelectItem value="Co-education">Co-education</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Warden Name</Label>
                      <Input value={hostelForm.wardenName} onChange={e => setHostelForm({ ...hostelForm, wardenName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input value={hostelForm.contactPhone} onChange={e => setHostelForm({ ...hostelForm, contactPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Rooms</Label>
                      <Input type="number" min="0" value={hostelForm.totalRooms} onChange={e => setHostelForm({ ...hostelForm, totalRooms: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Beds</Label>
                      <Input type="number" min="0" value={hostelForm.totalBeds} onChange={e => setHostelForm({ ...hostelForm, totalBeds: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={hostelForm.address} onChange={e => setHostelForm({ ...hostelForm, address: e.target.value })} />
                  </div>
                </div>
                <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setHostelDialog(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">{editingHostel ? "Update" : "Create"} Hostel</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-[#0B1B3D] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10"><Building2 className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Hostels</p>
                <h3 className="text-2xl font-bold">{hostels.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100"><Bed className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Beds</p>
                <h3 className="text-2xl font-bold">{totalBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100"><UserCheck className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Occupied</p>
                <h3 className="text-2xl font-bold">{occupiedBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100"><Home className="h-6 w-6 text-amber-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Available</p>
                <h3 className="text-2xl font-bold">{availableBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="hostels">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="hostels" className="gap-2"><Building2 className="h-4 w-4" /> Hostels</TabsTrigger>
          <TabsTrigger value="rooms" className="gap-2"><DoorOpen className="h-4 w-4" /> Rooms</TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2"><Users className="h-4 w-4" /> Allocations</TabsTrigger>
          <TabsTrigger value="visitors" className="gap-2"><BookOpen className="h-4 w-4" /> Visitors</TabsTrigger>
        </TabsList>

        <TabsContent value="hostels">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-secondary/50">
              <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-accent" /> Hostel Directory</CardTitle>
              <CardDescription>{hostels.length} hostel(s) registered under {schoolInfo.name}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Name</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Warden</TableHead>
                    <TableHead className="font-bold">Contact</TableHead>
                    <TableHead className="font-bold text-center">Rooms</TableHead>
                    <TableHead className="font-bold text-center">Beds</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>{[1,2,3,4].map(i => <TableRow key={i}>{[28,16,24,28,16,16,8].map((w,j) => <TableCell key={j} className={j===4||j===5?"text-center":j===6?"text-right":""}><Skeleton className={`h-4 w-${w}`} /></TableCell>)}</TableRow>)}</>
                  ) : hostels.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hostels registered. Add one to get started.</TableCell></TableRow>
                  ) : hostels.map(h => (
                    <TableRow key={h.id} className={`hover:bg-secondary/5 cursor-pointer ${selectedHostelId === h.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedHostelId(h.id)}>
                      <TableCell className="font-semibold text-primary py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-accent" />
                          {h.name}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={h.type === "Boys" ? "border-blue-200 text-blue-700 bg-blue-50" : h.type === "Girls" ? "border-pink-200 text-pink-700 bg-pink-50" : "border-purple-200 text-purple-700 bg-purple-50"}>{h.type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{h.wardenName || "\u2014"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.contactPhone || "\u2014"}</TableCell>
                      <TableCell className="text-center font-bold">{h.totalRooms}</TableCell>
                      <TableCell className="text-center font-bold">{h.totalBeds}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => { e.stopPropagation(); openEditHostel(h); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms">
          <div className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-secondary/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><DoorOpen className="h-5 w-5 text-accent" /> Room Directory</CardTitle>
                  <CardDescription>{selectedHostel ? `${selectedHostel.name} \u2022 ${hostelRooms.length} room(s)` : "Select a hostel to view rooms"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select hostel..." /></SelectTrigger>
                    <SelectContent>
                      {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedHostelId && (
                    <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={openAddRoom}>
                      <Plus className="h-4 w-4" /> Add Room
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="font-bold py-4">Room No.</TableHead>
                      <TableHead className="font-bold">Floor</TableHead>
                      <TableHead className="font-bold text-center">Capacity</TableHead>
                      <TableHead className="font-bold text-center">Occupied</TableHead>
                      <TableHead className="font-bold text-right">Fee (Monthly)</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hostelRooms.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{selectedHostelId ? "No rooms added yet." : "Select a hostel from the dropdown above."}</TableCell></TableRow>
                    ) : hostelRooms.map(r => (
                      <TableRow key={r.id} className="hover:bg-secondary/5">
                        <TableCell className="font-mono font-bold text-primary py-4">{r.roomNumber}</TableCell>
                        <TableCell className="text-muted-foreground">Floor {r.floor}</TableCell>
                        <TableCell className="text-center font-bold">{r.totalBeds}</TableCell>
                        <TableCell className="text-center font-bold">{r.occupiedBeds}</TableCell>
                        <TableCell className="text-right font-bold text-primary">Rs. {r.monthlyFee.toLocaleString()}</TableCell>
                        <TableCell className="text-center">{roomStatus(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
            <DialogContent className="max-w-lg border-secondary">
              <form onSubmit={handleSaveRoom}>
                <DialogHeader>
                  <DialogTitle className="font-headline font-bold text-primary">Add Room to {selectedHostel?.name}</DialogTitle>
                  <DialogDescription>Register a new room with bed capacity and fee.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Room Number</Label>
                      <Input value={roomForm.roomNumber} onChange={e => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="e.g. 101" />
                    </div>
                    <div className="space-y-2">
                      <Label>Floor</Label>
                      <Input type="number" min="0" value={roomForm.floor} onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Beds</Label>
                      <Input type="number" min="1" value={roomForm.totalBeds} onChange={e => setRoomForm({ ...roomForm, totalBeds: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Fee (Rs.)</Label>
                      <Input type="number" min="0" value={roomForm.monthlyFee} onChange={e => setRoomForm({ ...roomForm, monthlyFee: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setRoomDialog(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Add Room</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="allocations">
          <div className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-secondary/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-accent" /> Student Allocations</CardTitle>
                  <CardDescription>{selectedHostel ? `${selectedHostel.name} \u2022 ${hostelAllocations.length} allocation(s)` : "Select a hostel"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select hostel..." /></SelectTrigger>
                    <SelectContent>
                      {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedHostelId && (
                    <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={openAllocate}>
                      <Plus className="h-4 w-4" /> Allocate
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="font-bold py-4">Student</TableHead>
                      <TableHead className="font-bold">Room</TableHead>
                      <TableHead className="font-bold">Start Date</TableHead>
                      <TableHead className="font-bold">End Date</TableHead>
                      <TableHead className="font-bold text-right">Fee</TableHead>
                      <TableHead className="font-bold text-center">Paid</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hostelAllocations.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{selectedHostelId ? "No allocations yet." : "Select a hostel from the dropdown above."}</TableCell></TableRow>
                    ) : hostelAllocations.map(a => (
                      <TableRow key={a.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary py-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-accent" />
                            {a.studentName}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold">{a.roomNumber}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(a.startDate)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(a.endDate)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">Rs. {a.feeAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          {a.feePaid ? <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge> : <Badge className="bg-red-100 text-red-700 border-0">Unpaid</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={a.status === "Active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>{a.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Dialog open={allocateDialog} onOpenChange={setAllocateDialog}>
            <DialogContent className="max-w-lg border-secondary">
              <form onSubmit={handleAllocate}>
                <DialogHeader>
                  <DialogTitle className="font-headline font-bold text-primary">Allocate Room</DialogTitle>
                  <DialogDescription>Assign a student to a hostel room.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Room</Label>
                      <Select value={allocateForm.roomId} onValueChange={v => {
                        const r = rooms.find(room => room.id === v);
                        setAllocateForm({ ...allocateForm, roomId: v, feeAmount: r ? String(r.monthlyFee) : "" });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                        <SelectContent>
                          {hostelRooms.filter(r => r.isActive && r.occupiedBeds < r.totalBeds).map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.roomNumber} (Floor {r.floor}) \u2022 {r.occupiedBeds}/{r.totalBeds} beds
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Student</Label>
                      <Select value={allocateForm.studentId} onValueChange={v => setAllocateForm({ ...allocateForm, studentId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                        <SelectContent>
                          {students.filter(s => s.status === "Active").map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name} \u2014 {s.class}-{s.section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={allocateForm.startDate} onChange={e => setAllocateForm({ ...allocateForm, startDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={allocateForm.endDate} onChange={e => setAllocateForm({ ...allocateForm, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fee Amount (Rs.)</Label>
                      <Input type="number" min="0" value={allocateForm.feeAmount} onChange={e => setAllocateForm({ ...allocateForm, feeAmount: e.target.value })} />
                    </div>
                    <div className="space-y-2 flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={allocateForm.feePaid} onChange={e => setAllocateForm({ ...allocateForm, feePaid: e.target.checked })} className="rounded border-gray-300" />
                        <span className="text-sm font-medium">Fee Paid</span>
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setAllocateDialog(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Allocate</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="visitors">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-secondary/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent" /> Visitor Log</CardTitle>
                <CardDescription>Track visitor entries for {selectedHostel?.name || "selected hostel"}</CardDescription>
              </div>
              <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select hostel..." /></SelectTrigger>
                <SelectContent>
                  {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Visitor Name</TableHead>
                    <TableHead className="font-bold">Student</TableHead>
                    <TableHead className="font-bold">Relation</TableHead>
                    <TableHead className="font-bold">Phone</TableHead>
                    <TableHead className="font-bold">In Time</TableHead>
                    <TableHead className="font-bold">Out Time</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Visitor log feature coming soon. Record visitor entries with in/out timestamps.</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
