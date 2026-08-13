"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTransportRoutesDB, createTransportRouteDB,
  fetchTransportVehiclesDB,
} from "@/app/actions/features";
import { defaultTransportRoutes } from "@/lib/default-data";
import type { TransportRoute, TransportVehicle, TransportAllocation } from "@/lib/types";
import {
  MapPin, Bus, Users, Plus, Pencil, RefreshCw, Route, ArrowLeftRight,
  DollarSign, Truck, User, Phone, Calendar, ShieldCheck, Gauge,
} from "lucide-react";

const defaultVehicles: TransportVehicle[] = [
  { id: "veh-1", vehicleNumber: "LEA-2026-001", type: "Bus", capacity: 40, routeId: "route-1", driverName: "Mr. Muhammad Saleem", driverPhone: "0300-1112233", registrationDate: "2025-01-15", fitnessExpiry: "2027-01-15", insuranceExpiry: "2027-01-15", isActive: true },
  { id: "veh-2", vehicleNumber: "LEA-2026-002", type: "Bus", capacity: 40, routeId: "route-2", driverName: "Mr. Abdul Rehman", driverPhone: "0301-2223344", registrationDate: "2025-03-20", fitnessExpiry: "2027-03-20", insuranceExpiry: "2027-03-20", isActive: true },
  { id: "veh-3", vehicleNumber: "LEA-2026-003", type: "Van", capacity: 15, routeId: "route-3", driverName: "Mr. Tariq Mahmood", driverPhone: "0302-3334455", registrationDate: "2025-06-10", fitnessExpiry: "2027-06-10", insuranceExpiry: "2027-06-10", isActive: true },
];

export default function TransportPage() {
  const { students, schoolInfo } = useAppState();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [allocations, setAllocations] = useState<TransportAllocation[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");

  const [routeDialog, setRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeForm, setRouteForm] = useState({ routeName: "", startPoint: "", endPoint: "", stops: "", distance: "", feeAmount: "", isActive: true });

  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: "", type: "Bus", capacity: "", routeId: "", driverName: "", driverPhone: "", registrationDate: "", fitnessExpiry: "", insuranceExpiry: "", isActive: true });

  const [allocateDialog, setAllocateDialog] = useState(false);
  const [allocateForm, setAllocateForm] = useState({ routeId: "", vehicleId: "", studentId: "", pickupPoint: "", dropPoint: "", feeAmount: "", feePaid: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await fetchTransportRoutesDB();
      setRoutes(r.length > 0 ? r : defaultTransportRoutes);
      if (r.length > 0 && !selectedRouteId) setSelectedRouteId(r[0].id);
      else if (r.length === 0 && !selectedRouteId && defaultTransportRoutes.length > 0) setSelectedRouteId(defaultTransportRoutes[0].id);
    } catch {
      setRoutes(defaultTransportRoutes);
      if (!selectedRouteId && defaultTransportRoutes.length > 0) setSelectedRouteId(defaultTransportRoutes[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedRouteId) { setVehicles([]); setAllocations([]); return; }
    fetchTransportVehiclesDB(selectedRouteId).then(v => setVehicles(v.length > 0 ? v : defaultVehicles.filter(dv => dv.routeId === selectedRouteId)));
  }, [selectedRouteId]);

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const routeVehicles = selectedRouteId ? vehicles : [];
  const routeAllocations = selectedRouteId ? allocations : [];

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";

  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteForm({ routeName: "", startPoint: "", endPoint: "", stops: "", distance: "", feeAmount: "", isActive: true });
    setRouteDialog(true);
  };

  const openEditRoute = (r: TransportRoute) => {
    setEditingRoute(r);
    setRouteForm({ routeName: r.routeName, startPoint: r.startPoint, endPoint: r.endPoint, stops: r.stops.join(", "), distance: String(r.distance), feeAmount: String(r.feeAmount), isActive: r.isActive });
    setRouteDialog(true);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.routeName.trim()) { toast({ title: "Validation Error", description: "Route name is required.", variant: "destructive" }); return; }
    const stops = routeForm.stops.split(",").map(s => s.trim()).filter(Boolean);
    if (editingRoute) {
      setRoutes(prev => prev.map(r => r.id === editingRoute.id ? { ...r, routeName: routeForm.routeName.trim(), startPoint: routeForm.startPoint, endPoint: routeForm.endPoint, stops, distance: Number(routeForm.distance), feeAmount: Number(routeForm.feeAmount), isActive: routeForm.isActive } : r));
      toast({ title: "Route Updated", description: `"${routeForm.routeName}" saved.` });
    } else {
      const res = await createTransportRouteDB({ routeName: routeForm.routeName.trim(), startPoint: routeForm.startPoint, endPoint: routeForm.endPoint, stops, distance: Number(routeForm.distance), feeAmount: Number(routeForm.feeAmount), isActive: routeForm.isActive });
      if (res.id) {
        setRoutes(prev => [...prev, { id: res.id!, routeName: routeForm.routeName.trim(), startPoint: routeForm.startPoint, endPoint: routeForm.endPoint, stops, distance: Number(routeForm.distance), feeAmount: Number(routeForm.feeAmount), isActive: routeForm.isActive }]);
        toast({ title: "Route Created", description: `"${routeForm.routeName}" added.` });
      } else { toast({ title: "Error", description: res.error || "Failed.", variant: "destructive" }); }
    }
    setRouteDialog(false);
  };

  const openAddVehicle = () => {
    setVehicleForm({ vehicleNumber: "", type: "Bus", capacity: "", routeId: selectedRouteId, driverName: "", driverPhone: "", registrationDate: "", fitnessExpiry: "", insuranceExpiry: "", isActive: true });
    setVehicleDialog(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.vehicleNumber.trim()) { toast({ title: "Validation Error", description: "Vehicle number is required.", variant: "destructive" }); return; }
    const res = await fetch("/api/transport/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vehicleForm, vehicleNumber: vehicleForm.vehicleNumber.trim(), capacity: Number(vehicleForm.capacity) }),
    }).then(r => r.json()).catch(() => ({}));
    const newVehicle: TransportVehicle = {
      id: `tv_${Date.now()}`,
      vehicleNumber: vehicleForm.vehicleNumber.trim(),
      type: vehicleForm.type as TransportVehicle["type"],
      capacity: Number(vehicleForm.capacity),
      routeId: vehicleForm.routeId,
      driverName: vehicleForm.driverName,
      driverPhone: vehicleForm.driverPhone,
      registrationDate: vehicleForm.registrationDate,
      fitnessExpiry: vehicleForm.fitnessExpiry,
      insuranceExpiry: vehicleForm.insuranceExpiry,
      isActive: vehicleForm.isActive,
    };
    setVehicles(prev => [...prev, newVehicle]);
    toast({ title: "Vehicle Added", description: `${vehicleForm.vehicleNumber} registered.` });
    setVehicleDialog(false);
  };

  const openAllocate = () => {
    setAllocateForm({ routeId: selectedRouteId, vehicleId: "", studentId: "", pickupPoint: "", dropPoint: "", feeAmount: "", feePaid: false });
    setAllocateDialog(true);
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateForm.routeId || !allocateForm.studentId) { toast({ title: "Validation Error", description: "Select route and student.", variant: "destructive" }); return; }
    const student = students.find(s => s.id === allocateForm.studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    const route = routes.find(r => r.id === allocateForm.routeId);
    const newAlloc: TransportAllocation = {
      id: `ta_${Date.now()}`,
      routeId: allocateForm.routeId,
      vehicleId: allocateForm.vehicleId,
      studentId: student.id,
      studentName: student.name,
      pickupPoint: allocateForm.pickupPoint,
      dropPoint: allocateForm.dropPoint,
      feeAmount: Number(allocateForm.feeAmount),
      feePaid: allocateForm.feePaid,
      status: "Active",
    };
    setAllocations(prev => [newAlloc, ...prev]);
    toast({ title: "Allocated", description: `${student.name} assigned to ${route?.routeName || "route"}.` });
    setAllocateDialog(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Transport Management</h1>
          <p className="text-muted-foreground mt-1">Manage routes, vehicles, and student transport allocations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={loadData}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Dialog open={routeDialog} onOpenChange={setRouteDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={openAddRoute}>
                <Plus className="h-4 w-4" /> Add Route
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-secondary">
              <form onSubmit={handleSaveRoute}>
                <DialogHeader>
                  <DialogTitle className="font-headline font-bold text-primary">{editingRoute ? "Edit Route" : "Add New Route"}</DialogTitle>
                  <DialogDescription>Define a transport route with stops and fee.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Route Name</Label>
                    <Input value={routeForm.routeName} onChange={e => setRouteForm({ ...routeForm, routeName: e.target.value })} placeholder="e.g. North Campus Route" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Point</Label>
                      <Input value={routeForm.startPoint} onChange={e => setRouteForm({ ...routeForm, startPoint: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Point</Label>
                      <Input value={routeForm.endPoint} onChange={e => setRouteForm({ ...routeForm, endPoint: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Stops (comma-separated)</Label>
                    <Textarea value={routeForm.stops} onChange={e => setRouteForm({ ...routeForm, stops: e.target.value })} placeholder="Main St, College Rd, Market Square" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Distance (km)</Label>
                      <Input type="number" min="0" step="0.1" value={routeForm.distance} onChange={e => setRouteForm({ ...routeForm, distance: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fee Amount (Rs.)</Label>
                      <Input type="number" min="0" value={routeForm.feeAmount} onChange={e => setRouteForm({ ...routeForm, feeAmount: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setRouteDialog(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">{editingRoute ? "Update" : "Create"} Route</Button>
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
              <div className="p-3 rounded-full bg-white/10"><Route className="h-6 w-6" /></div>
              <div>
                <p className="text-white/60 text-sm font-medium">Total Routes</p>
                <h3 className="text-2xl font-bold">{routes.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100"><Bus className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Vehicles</p>
                <h3 className="text-2xl font-bold">{vehicles.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100"><Users className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Allocated Students</p>
                <h3 className="text-2xl font-bold">{allocations.filter(a => a.status === "Active").length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100"><DollarSign className="h-6 w-6 text-amber-600" /></div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Capacity</p>
                <h3 className="text-2xl font-bold">{vehicles.reduce((s, v) => s + v.capacity, 0)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="routes">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="routes" className="gap-2"><Route className="h-4 w-4" /> Routes</TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-2"><Bus className="h-4 w-4" /> Vehicles</TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2"><Users className="h-4 w-4" /> Allocations</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-secondary/50">
              <CardTitle className="text-lg flex items-center gap-2"><Route className="h-5 w-5 text-accent" /> Transport Routes</CardTitle>
              <CardDescription>{routes.length} route(s) configured under {schoolInfo.name}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="font-bold py-4">Route Name</TableHead>
                    <TableHead className="font-bold">Start \u2192 End</TableHead>
                    <TableHead className="font-bold">Stops</TableHead>
                    <TableHead className="font-bold text-center">Distance</TableHead>
                    <TableHead className="font-bold text-right">Fee</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>{[1,2,3,4].map(i => <TableRow key={i}>{[36,56,24,20,20,20,8].map((w,j) => <TableCell key={j} className={j===3||j===4?"text-right":""}><Skeleton className={`h-4 w-${w}`} /></TableCell>)}</TableRow>)}</>
                  ) : routes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No routes defined. Add one to get started.</TableCell></TableRow>
                  ) : routes.map(r => (
                    <TableRow key={r.id} className={`hover:bg-secondary/5 cursor-pointer ${selectedRouteId === r.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedRouteId(r.id)}>
                      <TableCell className="font-semibold text-primary py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-accent" />
                          {r.routeName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <span className="font-medium">{r.startPoint}</span> <ArrowLeftRight className="h-3 w-3 inline text-muted-foreground" /> <span className="font-medium">{r.endPoint}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.stops.length > 0 ? r.stops.slice(0, 3).join(", ") + (r.stops.length > 3 ? ` +${r.stops.length - 3}` : "") : "\u2014"}
                      </TableCell>
                      <TableCell className="text-center font-bold">{r.distance} km</TableCell>
                      <TableCell className="text-right font-bold text-primary">Rs. {r.feeAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        {r.isActive ? <Badge className="bg-green-100 text-green-700 border-0">Active</Badge> : <Badge className="bg-gray-100 text-gray-600 border-0">Inactive</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => { e.stopPropagation(); openEditRoute(r); }}>
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

        <TabsContent value="vehicles">
          <div className="space-y-4">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-secondary/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Bus className="h-5 w-5 text-accent" /> Fleet Directory</CardTitle>
                  <CardDescription>{selectedRoute ? `${selectedRoute.routeName} \u2022 ${routeVehicles.length} vehicle(s)` : "Select a route to view vehicles"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select route..." /></SelectTrigger>
                    <SelectContent>
                      {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedRouteId && (
                    <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={openAddVehicle}>
                      <Plus className="h-4 w-4" /> Add Vehicle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="font-bold py-4">Vehicle No.</TableHead>
                      <TableHead className="font-bold">Type</TableHead>
                      <TableHead className="font-bold text-center">Capacity</TableHead>
                      <TableHead className="font-bold">Driver</TableHead>
                      <TableHead className="font-bold">Driver Phone</TableHead>
                      <TableHead className="font-bold text-xs">Fitness Expiry</TableHead>
                      <TableHead className="font-bold text-xs">Insurance Expiry</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeVehicles.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{selectedRouteId ? "No vehicles assigned to this route." : "Select a route from the dropdown above."}</TableCell></TableRow>
                    ) : routeVehicles.map(v => (
                      <TableRow key={v.id} className="hover:bg-secondary/5">
                        <TableCell className="font-mono font-bold text-primary py-4">{v.vehicleNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={v.type === "Bus" ? "border-blue-200 text-blue-700 bg-blue-50" : v.type === "Van" ? "border-orange-200 text-orange-700 bg-orange-50" : "border-green-200 text-green-700 bg-green-50"}>{v.type}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{v.capacity}</TableCell>
                        <TableCell className="text-muted-foreground"><div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{v.driverName || "\u2014"}</div></TableCell>
                        <TableCell className="text-muted-foreground"><div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{v.driverPhone || "\u2014"}</div></TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className={v.fitnessExpiry && new Date(v.fitnessExpiry) < new Date() ? "text-red-600 font-semibold" : "text-muted-foreground"}>{formatDate(v.fitnessExpiry)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                            <span className={v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date() ? "text-red-600 font-semibold" : "text-muted-foreground"}>{formatDate(v.insuranceExpiry)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {v.isActive ? <Badge className="bg-green-100 text-green-700 border-0">Active</Badge> : <Badge className="bg-gray-100 text-gray-600 border-0">Inactive</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}>
            <DialogContent className="max-w-lg border-secondary">
              <form onSubmit={handleSaveVehicle}>
                <DialogHeader>
                  <DialogTitle className="font-headline font-bold text-primary">Add Vehicle to {selectedRoute?.routeName}</DialogTitle>
                  <DialogDescription>Register a new vehicle for this transport route.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vehicle Number</Label>
                      <Input value={vehicleForm.vehicleNumber} onChange={e => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })} placeholder="e.g. ABC-1234" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={vehicleForm.type} onValueChange={v => setVehicleForm({ ...vehicleForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bus">Bus</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                          <SelectItem value="Car">Car</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Input type="number" min="1" value={vehicleForm.capacity} onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Route</Label>
                      <Select value={vehicleForm.routeId} onValueChange={v => setVehicleForm({ ...vehicleForm, routeId: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Driver Name</Label>
                      <Input value={vehicleForm.driverName} onChange={e => setVehicleForm({ ...vehicleForm, driverName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Driver Phone</Label>
                      <Input value={vehicleForm.driverPhone} onChange={e => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Registration Date</Label>
                      <Input type="date" value={vehicleForm.registrationDate} onChange={e => setVehicleForm({ ...vehicleForm, registrationDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fitness Expiry</Label>
                      <Input type="date" value={vehicleForm.fitnessExpiry} onChange={e => setVehicleForm({ ...vehicleForm, fitnessExpiry: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Insurance Expiry</Label>
                      <Input type="date" value={vehicleForm.insuranceExpiry} onChange={e => setVehicleForm({ ...vehicleForm, insuranceExpiry: e.target.value })} />
                    </div>
                    <div className="space-y-2 flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={vehicleForm.isActive} onChange={e => setVehicleForm({ ...vehicleForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                        <span className="text-sm font-medium">Active</span>
                      </label>
                    </div>
                  </div>
                </div>
                <DialogFooter className="bg-secondary/15 p-4 -mx-6 -mb-6 flex gap-2 justify-end rounded-b-lg">
                  <Button type="button" variant="outline" onClick={() => setVehicleDialog(false)}>Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Add Vehicle</Button>
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
                  <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-accent" /> Transport Allocations</CardTitle>
                  <CardDescription>{selectedRoute ? `${selectedRoute.routeName} \u2022 ${routeAllocations.length} allocation(s)` : "Select a route"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select route..." /></SelectTrigger>
                    <SelectContent>
                      {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedRouteId && (
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
                      <TableHead className="font-bold">Pickup</TableHead>
                      <TableHead className="font-bold">Drop</TableHead>
                      <TableHead className="font-bold text-right">Fee</TableHead>
                      <TableHead className="font-bold text-center">Paid</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeAllocations.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{selectedRouteId ? "No allocations for this route." : "Select a route from the dropdown above."}</TableCell></TableRow>
                    ) : routeAllocations.map(a => (
                      <TableRow key={a.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary py-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-accent" />
                            {a.studentName}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.pickupPoint || "\u2014"}</TableCell>
                        <TableCell className="text-muted-foreground">{a.dropPoint || "\u2014"}</TableCell>
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
                  <DialogTitle className="font-headline font-bold text-primary">Allocate Transport</DialogTitle>
                  <DialogDescription>Assign a student to a transport route.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Route</Label>
                      <Select value={allocateForm.routeId} onValueChange={v => {
                        const r = routes.find(route => route.id === v);
                        setAllocateForm({ ...allocateForm, routeId: v, feeAmount: r ? String(r.feeAmount) : "" });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select route..." /></SelectTrigger>
                        <SelectContent>
                          {routes.filter(r => r.isActive).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Vehicle (optional)</Label>
                      <Select value={allocateForm.vehicleId} onValueChange={v => setAllocateForm({ ...allocateForm, vehicleId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                        <SelectContent>
                          {vehicles.filter(v => v.isActive).map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} ({v.type})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pickup Point</Label>
                      <Input value={allocateForm.pickupPoint} onChange={e => setAllocateForm({ ...allocateForm, pickupPoint: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Drop Point</Label>
                      <Input value={allocateForm.dropPoint} onChange={e => setAllocateForm({ ...allocateForm, dropPoint: e.target.value })} />
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
      </Tabs>
    </div>
  );
}
