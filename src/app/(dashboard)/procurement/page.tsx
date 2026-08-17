"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/lib/state-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { Unauthorized } from "@/components/unauthorized";
import { PurchaseRequest, PurchaseItem, PurchaseOrder, GoodsReceipt } from "@/lib/types";
import { fetchPurchaseRequestsDB, createPurchaseRequestDB, approvePurchaseRequestDB } from "@/app/actions/features";
import {
  ShoppingCart, ClipboardList, Truck, Plus, Search, Loader2,
  CheckCircle2, XCircle, Clock, AlertTriangle, Container, FileText,
  Building2, User, DollarSign, ArrowUpDown,
} from "lucide-react";

const priorities = ["Low", "Medium", "High", "Urgent"] as const;
const departments = ["Administration", "Academics", "IT", "Facilities", "Library", "Sports", "Transport", "Hostel", "Finance", "Other"];

interface PRItemRow {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
}

export default function ProcurementPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [loading, setLoading] = useState(true);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("requests");

  const [createOpen, setCreateOpen] = useState(false);
  const [prForm, setPrForm] = useState({ requestedBy: "", department: "IT", description: "", priority: "Medium" as PurchaseRequest["priority"] });
  const [prItems, setPrItems] = useState<PRItemRow[]>([{ key: "1", name: "", quantity: 1, unit: "pcs", estimatedCost: 0 }]);

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ poNumber: "", supplierName: "", orderDate: "", deliveryDate: "", notes: "" });
  const [orderItems, setOrderItems] = useState<{ name: string; quantity: number; unitPrice: number; total: number }[]>([]);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ poId: "", receivedDate: new Date().toISOString().split("T")[0], receivedBy: "", notes: "" });
  const [receiptItems, setReceiptItems] = useState<{ name: string; quantityReceived: number; condition: string }[]>([]);

  const isAdmin = (activeRole === "ADMIN" || activeRole === "PRINCIPAL");

  const loadData = async () => {
    setLoading(true);
    const [pr] = await Promise.all([
      fetchPurchaseRequestsDB(),
    ]);
    setPurchaseRequests(pr);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const prTotal = (items: PurchaseItem[]) => items.reduce((s, i) => s + i.quantity * i.estimatedCost, 0);

  const filteredPRs = purchaseRequests.filter(pr => {
    const q = search.toLowerCase();
    return pr.requestedBy.toLowerCase().includes(q) || pr.department.toLowerCase().includes(q) || pr.description.toLowerCase().includes(q);
  });

  const pendingPRs = purchaseRequests.filter(pr => pr.status === "Pending" || pr.status === "Draft");
  const approvedPRs = purchaseRequests.filter(pr => pr.status === "Approved");
  const totalOrderValue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalReceived = goodsReceipts.length;

  const addItemRow = () => {
    setPrItems(prev => [...prev, { key: `${Date.now()}_${prev.length}`, name: "", quantity: 1, unit: "pcs", estimatedCost: 0 }]);
  };

  const removeItemRow = (key: string) => {
    if (prItems.length <= 1) return;
    setPrItems(prev => prev.filter(i => i.key !== key));
  };

  const updateItemRow = (key: string, field: keyof PRItemRow, value: string | number) => {
    setPrItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prForm.requestedBy || !prForm.description) {
      toast({ title: "Requested by and description are required.", variant: "destructive" });
      return;
    }
    const validItems = prItems.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast({ title: "At least one item is required.", variant: "destructive" });
      return;
    }
    const items: PurchaseItem[] = validItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, estimatedCost: i.estimatedCost }));
    const totalCost = prTotal(items);
    const res = await createPurchaseRequestDB({
      requestedBy: prForm.requestedBy,
      department: prForm.department,
      description: prForm.description,
      items,
      totalCost,
      priority: prForm.priority,
      status: "Pending",
      createdAt: new Date().toISOString().split("T")[0],
      approvedBy: "",
    });
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Purchase request submitted." });
    setCreateOpen(false);
    setPrForm({ requestedBy: "", department: "IT", description: "", priority: "Medium" });
    setPrItems([{ key: "1", name: "", quantity: 1, unit: "pcs", estimatedCost: 0 }]);
    loadData();
  };

  const handleApprovePR = async (id: string) => {
    const res = await approvePurchaseRequestDB(id, prForm.requestedBy || "Admin");
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Purchase request approved." });
    loadData();
  };

  const handleRejectPR = async (id: string) => {
    setPurchaseRequests(prev => prev.map(pr => pr.id === id ? { ...pr, status: "Rejected" as const } : pr));
    toast({ title: "Purchase request rejected." });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.poNumber || !orderForm.supplierName) {
      toast({ title: "PO Number and Supplier are required.", variant: "destructive" });
      return;
    }
    const newOrder: PurchaseOrder = {
      id: `po_${Date.now()}`,
      poNumber: orderForm.poNumber,
      supplierName: orderForm.supplierName,
      items: orderItems,
      totalAmount: orderItems.reduce((s, i) => s + i.total, 0),
      orderDate: orderForm.orderDate,
      deliveryDate: orderForm.deliveryDate,
      status: "Ordered",
      paymentStatus: "Unpaid",
      notes: orderForm.notes,
    };
    setOrders(prev => [newOrder, ...prev]);
    toast({ title: "Purchase order created." });
    setOrderOpen(false);
    setOrderForm({ poNumber: "", supplierName: "", orderDate: "", deliveryDate: "", notes: "" });
    setOrderItems([]);
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.poId || !receiptForm.receivedBy) {
      toast({ title: "PO and receiver are required.", variant: "destructive" });
      return;
    }
    const newReceipt: GoodsReceipt = {
      id: `gr_${Date.now()}`,
      poId: receiptForm.poId,
      receivedDate: receiptForm.receivedDate,
      items: receiptItems,
      receivedBy: receiptForm.receivedBy,
      notes: receiptForm.notes,
    };
    setGoodsReceipts(prev => [newReceipt, ...prev]);
    setOrders(prev => prev.map(o => o.id === receiptForm.poId ? { ...o, status: "Received" as PurchaseOrder["status"] } : o));
    toast({ title: "Goods receipt recorded." });
    setReceiptOpen(false);
    setReceiptForm({ poId: "", receivedDate: new Date().toISOString().split("T")[0], receivedBy: "", notes: "" });
    setReceiptItems([]);
  };

  if (!permsLoaded) return null;
  if (!can("procurement.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Procurement Management</h1>
          <p className="text-muted-foreground mt-1">Manage purchase requests, orders, and goods receiving</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create PR</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Purchase Request</DialogTitle></DialogHeader>
              <form onSubmit={handleCreatePR} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Requested By *</Label><Input value={prForm.requestedBy} onChange={e => setPrForm(f => ({...f, requestedBy: e.target.value}))} placeholder="e.g. Jane Doe" /></div>
                  <div className="space-y-1"><Label>Department</Label>
                    <Select value={prForm.department} onValueChange={v => setPrForm(f => ({...f, department: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Description *</Label><Textarea value={prForm.description} onChange={e => setPrForm(f => ({...f, description: e.target.value}))} placeholder="Purpose of this request..." rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Priority</Label>
                    <Select value={prForm.priority} onValueChange={v => setPrForm(f => ({...f, priority: v as PurchaseRequest["priority"]}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Items</Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addItemRow}><Plus className="h-3 w-3" /> Add Item</Button>
                  </div>
                  <div className="border rounded-lg p-3 space-y-2">
                    {prItems.map((item, idx) => (
                      <div key={item.key} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4"><Label className="text-xs">Name</Label><Input value={item.name} onChange={e => updateItemRow(item.key, "name", e.target.value)} placeholder="Item name" /></div>
                        <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" min={1} value={item.quantity} onChange={e => updateItemRow(item.key, "quantity", parseInt(e.target.value) || 0)} /></div>
                        <div className="col-span-2"><Label className="text-xs">Unit</Label>
                          <Select value={item.unit} onValueChange={v => updateItemRow(item.key, "unit", v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["pcs", "box", "pack", "kg", "liter", "meter", "set", "pair", "roll", "bottle"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3"><Label className="text-xs">Est. Cost</Label><Input type="number" min={0} value={item.estimatedCost || ""} onChange={e => updateItemRow(item.key, "estimatedCost", parseFloat(e.target.value) || 0)} /></div>
                        <div className="col-span-1 flex items-center pb-0.5">
                          {prItems.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItemRow(item.key)}><XCircle className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-sm font-semibold text-right pt-2 border-t">Total: ${prTotal(prItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, estimatedCost: i.estimatedCost }))).toLocaleString()}</p>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit">Submit Request</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Truck className="h-4 w-4" /> Create PO</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateOrder} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>PO Number *</Label><Input value={orderForm.poNumber} onChange={e => setOrderForm(f => ({...f, poNumber: e.target.value}))} placeholder="PO-001" /></div>
                  <div className="space-y-1"><Label>Supplier *</Label><Input value={orderForm.supplierName} onChange={e => setOrderForm(f => ({...f, supplierName: e.target.value}))} placeholder="Supplier name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Order Date</Label><Input type="date" value={orderForm.orderDate} onChange={e => setOrderForm(f => ({...f, orderDate: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm(f => ({...f, deliveryDate: e.target.value}))} /></div>
                </div>
                <div className="space-y-1"><Label>Notes</Label><Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
                <div className="space-y-2">
                  <Label>Items (from approved PRs)</Label>
                  <Select onValueChange={v => {
                    const pr = purchaseRequests.find(p => p.id === v);
                    if (pr) setOrderItems(pr.items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.estimatedCost, total: i.quantity * i.estimatedCost })));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select approved PR..." /></SelectTrigger>
                    <SelectContent>
                      {purchaseRequests.filter(p => p.status === "Approved").map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.description} — {p.department} (${p.totalCost})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {orderItems.length > 0 && (
                    <div className="border rounded p-2 text-sm space-y-1">
                      {orderItems.map((item, i) => (
                        <div key={i} className="flex justify-between"><span>{item.name} x{item.quantity}</span><span>${(item.quantity * item.unitPrice).toLocaleString()}</span></div>
                      ))}
                      <div className="border-t pt-1 font-bold flex justify-between"><span>Total</span><span>${orderItems.reduce((s, i) => s + i.total, 0).toLocaleString()}</span></div>
                    </div>
                  )}
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setOrderOpen(false)}>Cancel</Button><Button type="submit">Create PO</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><ClipboardList className="h-4 w-4" /> Record Receipt</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Goods Receipt</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateReceipt} className="space-y-4 py-2">
                <div className="space-y-1"><Label>Purchase Order *</Label>
                  <Select value={receiptForm.poId} onValueChange={v => {
                    const po = orders.find(o => o.id === v);
                    setReceiptForm(f => ({...f, poId: v}));
                    if (po) setReceiptItems(po.items.map(i => ({ name: i.name, quantityReceived: i.quantity, condition: "Good" })));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select PO..." /></SelectTrigger>
                    <SelectContent>{orders.filter(o => o.status !== "Received").map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.poNumber} — {o.supplierName}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Received Date</Label><Input type="date" value={receiptForm.receivedDate} onChange={e => setReceiptForm(f => ({...f, receivedDate: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Received By *</Label><Input value={receiptForm.receivedBy} onChange={e => setReceiptForm(f => ({...f, receivedBy: e.target.value}))} placeholder="Receiver name" /></div>
                </div>
                {receiptItems.length > 0 && (
                  <div className="space-y-2">
                    <Label>Receiving Items</Label>
                    <div className="border rounded p-3 space-y-2">
                      {receiptItems.map((item, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 items-end">
                          <div className="col-span-1"><Label className="text-xs">Item</Label><p className="text-sm font-medium">{item.name}</p></div>
                          <div className="col-span-1"><Label className="text-xs">Qty Received</Label><Input type="number" min={0} value={item.quantityReceived} onChange={e => setReceiptItems(prev => prev.map((ri, j) => j === i ? {...ri, quantityReceived: parseInt(e.target.value) || 0} : ri))} /></div>
                          <div className="col-span-1"><Label className="text-xs">Condition</Label>
                            <Select value={item.condition} onValueChange={v => setReceiptItems(prev => prev.map((ri, j) => j === i ? {...ri, condition: v} : ri))}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Good", "Damaged", "Partial"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1"><Label>Notes</Label><Textarea value={receiptForm.notes} onChange={e => setReceiptForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setReceiptOpen(false)}>Cancel</Button><Button type="submit">Record Receipt</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
          <p className="text-xs font-semibold text-blue-600">Pending PRs</p>
          <p className="text-2xl font-bold text-primary mt-1">{pendingPRs.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-green-50 border-green-100">
          <p className="text-xs font-semibold text-green-600">Approved</p>
          <p className="text-2xl font-bold text-primary mt-1">{approvedPRs.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
          <p className="text-xs font-semibold text-purple-600">Orders</p>
          <p className="text-2xl font-bold text-primary mt-1">{orders.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-amber-50 border-amber-100">
          <p className="text-xs font-semibold text-amber-600">Received</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalReceived}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-2"><ShoppingCart className="h-4 w-4" /> Requests</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><Truck className="h-4 w-4" /> Orders</TabsTrigger>
          <TabsTrigger value="receiving" className="gap-2"><ClipboardList className="h-4 w-4" /> Receiving</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Purchase Requests</CardTitle>
                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-72" />
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
                      <TableHead className="font-bold">Requested By</TableHead>
                      <TableHead className="font-bold">Department</TableHead>
                      <TableHead className="font-bold">Description</TableHead>
                      <TableHead className="font-bold text-center">Items</TableHead>
                      <TableHead className="font-bold text-right">Total</TableHead>
                      <TableHead className="font-bold text-center">Priority</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      {isAdmin && <TableHead className="w-24 text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPRs.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-10 text-muted-foreground">No purchase requests found.</TableCell></TableRow>
                    ) : filteredPRs.map(pr => (
                      <TableRow key={pr.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary">{pr.requestedBy}</TableCell>
                        <TableCell><Badge className="bg-sky-50 text-sky-700 border-0">{pr.department}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{pr.description}</TableCell>
                        <TableCell className="text-center">{pr.items.length}</TableCell>
                        <TableCell className="text-right font-semibold">${pr.totalCost.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            pr.priority === "Urgent" ? "bg-red-100 text-red-700 border-0" :
                            pr.priority === "High" ? "bg-orange-100 text-orange-700 border-0" :
                            pr.priority === "Medium" ? "bg-amber-100 text-amber-700 border-0" :
                            "bg-green-100 text-green-700 border-0"
                          }>{pr.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            pr.status === "Draft" ? "bg-gray-100 text-gray-600 border-0" :
                            pr.status === "Pending" ? "bg-blue-100 text-blue-700 border-0" :
                            pr.status === "Approved" ? "bg-green-100 text-green-700 border-0" :
                            "bg-red-100 text-red-700 border-0"
                          }>{pr.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{pr.createdAt}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              {pr.status === "Pending" && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => handleApprovePR(pr.id)}><CheckCircle2 className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleRejectPR(pr.id)}><XCircle className="h-4 w-4" /></Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Purchase Orders</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="font-bold">PO Number</TableHead>
                    <TableHead className="font-bold">Supplier</TableHead>
                    <TableHead className="font-bold text-right">Total</TableHead>
                    <TableHead className="font-bold">Order Date</TableHead>
                    <TableHead className="font-bold">Delivery</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-center">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No purchase orders. Click "Create PO" to add one.</TableCell></TableRow>
                  ) : orders.map(order => (
                    <TableRow key={order.id} className="hover:bg-secondary/5">
                      <TableCell className="font-mono font-bold text-primary">{order.poNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{order.supplierName}</TableCell>
                      <TableCell className="text-right font-semibold">${order.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{order.orderDate || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{order.deliveryDate || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          order.status === "Ordered" ? "bg-blue-100 text-blue-700 border-0" :
                          order.status === "Partially Received" ? "bg-amber-100 text-amber-700 border-0" :
                          order.status === "Received" ? "bg-green-100 text-green-700 border-0" :
                          "bg-red-100 text-red-700 border-0"
                        }>{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          order.paymentStatus === "Unpaid" ? "bg-red-100 text-red-700 border-0" :
                          order.paymentStatus === "Partial" ? "bg-amber-100 text-amber-700 border-0" :
                          "bg-green-100 text-green-700 border-0"
                        }>{order.paymentStatus}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receiving">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Container className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Goods Receipt Records</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="font-bold">PO</TableHead>
                    <TableHead className="font-bold">Received Date</TableHead>
                    <TableHead className="font-bold">Items</TableHead>
                    <TableHead className="font-bold">Received By</TableHead>
                    <TableHead className="font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goodsReceipts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No goods receipts recorded. Click "Record Receipt" to add one.</TableCell></TableRow>
                  ) : goodsReceipts.map(gr => (
                    <TableRow key={gr.id} className="hover:bg-secondary/5">
                      <TableCell className="font-mono font-bold text-primary">{gr.poId}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{gr.receivedDate}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{gr.items.map(i => `${i.name} (${i.quantityReceived})`).join(", ")}</TableCell>
                      <TableCell className="text-muted-foreground">{gr.receivedBy}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{gr.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
