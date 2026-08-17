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
import { Asset, MaintenanceRecord, ConsumableItem } from "@/lib/types";
import { fetchAssetsDB, createAssetDB, fetchConsumableItemsDB } from "@/app/actions/features";
import {
  Package, ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Clock,
  Wrench, ClipboardList, Box, Settings2, Plus, Search, Loader2,
  Factory, Container, Warehouse, HardHat,
} from "lucide-react";

const assetCategories = ["IT Equipment", "Furniture", "Vehicles", "Lab Equipment", "Office Equipment", "Audio Visual", "Sports Equipment", "Library", "Security", "Other"];
const assetStatuses = ["In Use", "Available", "Under Maintenance", "Disposed"] as const;
const maintTypes = ["Routine", "Repair", "Emergency"] as const;
const maintStatuses = ["Scheduled", "In Progress", "Completed"] as const;

const blankAsset: Omit<Asset, "id"> = {
  name: "", category: "IT Equipment", assetTag: "", location: "", purchaseDate: "",
  purchaseCost: 0, currentValue: 0, vendor: "", warrantyExpiry: "", status: "Available",
  assignedTo: "", notes: "",
};

export default function InventoryPage() {
  const { activeRole } = useAppState();
  const { toast } = useToast();
  const { can, loaded: permsLoaded } = usePermission();

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("assets");

  const [createOpen, setCreateOpen] = useState(false);
  const [assetForm, setAssetForm] = useState(blankAsset);

  const [maintOpen, setMaintOpen] = useState(false);
  const [maintAssetId, setMaintAssetId] = useState("");
  const [maintForm, setMaintForm] = useState({ maintenanceType: "Routine" as MaintenanceRecord["maintenanceType"], description: "", cost: 0, performedBy: "", scheduledDate: "", completedDate: "", status: "Scheduled" as MaintenanceRecord["status"] });

  const isAdmin = (activeRole === "ADMIN" || activeRole === "PRINCIPAL");

  const loadData = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      fetchAssetsDB(),
      fetchConsumableItemsDB(),
    ]);
    setAssets(a);
    setConsumables(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredAssets = assets.filter(a => {
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.assetTag.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.location.toLowerCase().includes(q);
  });

  const assetsByCategory = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});
  const underMaintenanceCount = assets.filter(a => a.status === "Under Maintenance").length;
  const consumableValue = consumables.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const lowStockItems = consumables.filter(c => c.quantity <= c.minStockLevel);

  const assetMaintRecords = (assetId: string) => maintenanceRecords.filter(m => m.assetId === assetId);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name || !assetForm.assetTag) {
      toast({ title: "Name and Asset Tag are required.", variant: "destructive" });
      return;
    }
    const res = await createAssetDB(assetForm);
    if (res.error) { toast({ title: res.error, variant: "destructive" }); return; }
    toast({ title: "Asset created successfully." });
    setCreateOpen(false);
    setAssetForm(blankAsset);
    loadData();
  };

  const handleAddMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintAssetId || !maintForm.description) {
      toast({ title: "Asset and description are required.", variant: "destructive" });
      return;
    }
    const asset = assets.find(a => a.id === maintAssetId);
    const record: MaintenanceRecord = {
      id: `mr_${Date.now()}`,
      assetId: maintAssetId,
      assetName: asset?.name || "",
      maintenanceType: maintForm.maintenanceType,
      description: maintForm.description,
      cost: maintForm.cost,
      performedBy: maintForm.performedBy,
      scheduledDate: maintForm.scheduledDate,
      completedDate: maintForm.completedDate,
      status: maintForm.status,
    };
    setMaintenanceRecords(prev => [record, ...prev]);
    toast({ title: "Maintenance record added." });
    setMaintOpen(false);
    setMaintAssetId("");
    setMaintForm({ maintenanceType: "Routine", description: "", cost: 0, performedBy: "", scheduledDate: "", completedDate: "", status: "Scheduled" });
  };

  if (!permsLoaded) return null;
  if (!can("inventory.view")) return <Unauthorized />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary font-headline">Inventory & Asset Management</h1>
          <p className="text-muted-foreground mt-1">Track assets, maintenance records, and consumable stock</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create Asset</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Asset</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateAsset} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Name *</Label><Input value={assetForm.name} onChange={e => setAssetForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Dell OptiPlex 7090" /></div>
                  <div className="space-y-1"><Label>Asset Tag *</Label><Input value={assetForm.assetTag} onChange={e => setAssetForm(f => ({...f, assetTag: e.target.value}))} placeholder="e.g. AST-001" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Category</Label>
                    <Select value={assetForm.category} onValueChange={v => setAssetForm(f => ({...f, category: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{assetCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Location</Label><Input value={assetForm.location} onChange={e => setAssetForm(f => ({...f, location: e.target.value}))} placeholder="e.g. Room 201" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Purchase Date</Label><Input type="date" value={assetForm.purchaseDate} onChange={e => setAssetForm(f => ({...f, purchaseDate: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Vendor</Label><Input value={assetForm.vendor} onChange={e => setAssetForm(f => ({...f, vendor: e.target.value}))} placeholder="e.g. TechWorld" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Purchase Cost ($)</Label><Input type="number" min={0} value={assetForm.purchaseCost || ""} onChange={e => setAssetForm(f => ({...f, purchaseCost: parseFloat(e.target.value) || 0}))} /></div>
                  <div className="space-y-1"><Label>Current Value ($)</Label><Input type="number" min={0} value={assetForm.currentValue || ""} onChange={e => setAssetForm(f => ({...f, currentValue: parseFloat(e.target.value) || 0}))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Warranty Expiry</Label><Input type="date" value={assetForm.warrantyExpiry} onChange={e => setAssetForm(f => ({...f, warrantyExpiry: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={assetForm.status} onValueChange={v => setAssetForm(f => ({...f, status: v as Asset["status"]}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{assetStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Assigned To</Label><Input value={assetForm.assignedTo} onChange={e => setAssetForm(f => ({...f, assignedTo: e.target.value}))} placeholder="e.g. John Smith" /></div>
                <div className="space-y-1"><Label>Notes</Label><Textarea value={assetForm.notes} onChange={e => setAssetForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." rows={2} /></div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit">Create Asset</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Wrench className="h-4 w-4" /> Add Maintenance</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Maintenance Record</DialogTitle></DialogHeader>
              <form onSubmit={handleAddMaintenance} className="space-y-4 py-2">
                <div className="space-y-1"><Label>Asset *</Label>
                  <Select value={maintAssetId} onValueChange={setMaintAssetId}>
                    <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                    <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.assetTag})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Type</Label>
                    <Select value={maintForm.maintenanceType} onValueChange={v => setMaintForm(f => ({...f, maintenanceType: v as MaintenanceRecord["maintenanceType"]}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{maintTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={maintForm.status} onValueChange={v => setMaintForm(f => ({...f, status: v as MaintenanceRecord["status"]}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{maintStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Description *</Label><Textarea value={maintForm.description} onChange={e => setMaintForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Cost ($)</Label><Input type="number" min={0} value={maintForm.cost || ""} onChange={e => setMaintForm(f => ({...f, cost: parseFloat(e.target.value) || 0}))} /></div>
                  <div className="space-y-1"><Label>Performed By</Label><Input value={maintForm.performedBy} onChange={e => setMaintForm(f => ({...f, performedBy: e.target.value}))} placeholder="Technician name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Scheduled Date</Label><Input type="date" value={maintForm.scheduledDate} onChange={e => setMaintForm(f => ({...f, scheduledDate: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Completed Date</Label><Input type="date" value={maintForm.completedDate} onChange={e => setMaintForm(f => ({...f, completedDate: e.target.value}))} /></div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setMaintOpen(false)}>Cancel</Button><Button type="submit">Add Record</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
          <p className="text-xs font-semibold text-blue-600">Total Assets</p>
          <p className="text-2xl font-bold text-primary mt-1">{assets.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-purple-50 border-purple-100">
          <p className="text-xs font-semibold text-purple-600">Categories</p>
          <p className="text-2xl font-bold text-primary mt-1">{Object.keys(assetsByCategory).length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-amber-50 border-amber-100">
          <p className="text-xs font-semibold text-amber-600">Under Maintenance</p>
          <p className="text-2xl font-bold text-primary mt-1">{underMaintenanceCount}</p>
        </div>
        <div className="p-4 rounded-xl border bg-green-50 border-green-100">
          <p className="text-xs font-semibold text-green-600">Consumable Value</p>
          <p className="text-2xl font-bold text-primary mt-1">${consumableValue.toLocaleString()}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assets" className="gap-2"><Package className="h-4 w-4" /> Assets</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2"><Wrench className="h-4 w-4" /> Maintenance</TabsTrigger>
          <TabsTrigger value="consumables" className="gap-2"><Box className="h-4 w-4" /> Consumables</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Factory className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">All Assets</CardTitle>
                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-72" />
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
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Asset Tag</TableHead>
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="font-bold">Location</TableHead>
                      <TableHead className="font-bold text-right">Value</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="font-bold">Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No assets found.</TableCell></TableRow>
                    ) : filteredAssets.map(asset => (
                      <TableRow key={asset.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary">{asset.name}</TableCell>
                        <TableCell className="font-mono text-xs">{asset.assetTag}</TableCell>
                        <TableCell><Badge className="bg-purple-50 text-purple-700 border-0">{asset.category}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{asset.location || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">${asset.currentValue.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            asset.status === "In Use" ? "bg-blue-100 text-blue-700 border-0" :
                            asset.status === "Available" ? "bg-green-100 text-green-700 border-0" :
                            asset.status === "Under Maintenance" ? "bg-amber-100 text-amber-700 border-0" :
                            "bg-gray-100 text-gray-600 border-0"
                          }>{asset.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{asset.assignedTo || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Maintenance Records</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead className="font-bold">Asset</TableHead>
                      <TableHead className="font-bold">Type</TableHead>
                      <TableHead className="font-bold">Description</TableHead>
                      <TableHead className="font-bold text-right">Cost</TableHead>
                      <TableHead className="font-bold">Performed By</TableHead>
                      <TableHead className="font-bold">Scheduled</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceRecords.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No maintenance records. Click "Add Maintenance" to create one.</TableCell></TableRow>
                    ) : maintenanceRecords.map(rec => (
                      <TableRow key={rec.id} className="hover:bg-secondary/5">
                        <TableCell className="font-semibold text-primary">{rec.assetName}</TableCell>
                        <TableCell>
                          <Badge className={
                            rec.maintenanceType === "Routine" ? "bg-green-100 text-green-700 border-0" :
                            rec.maintenanceType === "Repair" ? "bg-amber-100 text-amber-700 border-0" :
                            "bg-red-100 text-red-700 border-0"
                          }>{rec.maintenanceType}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{rec.description}</TableCell>
                        <TableCell className="text-right font-semibold">${rec.cost.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{rec.performedBy || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{rec.scheduledDate || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            rec.status === "Scheduled" ? "bg-blue-100 text-blue-700 border-0" :
                            rec.status === "In Progress" ? "bg-amber-100 text-amber-700 border-0" :
                            "bg-green-100 text-green-700 border-0"
                          }>{rec.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumables">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <Container className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Consumable Items</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="font-bold">Unit</TableHead>
                      <TableHead className="font-bold text-center">Quantity</TableHead>
                      <TableHead className="font-bold text-center">Min Stock</TableHead>
                      <TableHead className="font-bold text-right">Unit Price</TableHead>
                      <TableHead className="font-bold text-right">Total Value</TableHead>
                      <TableHead className="font-bold text-center">Alert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumables.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No consumable items found.</TableCell></TableRow>
                    ) : consumables.map(item => {
                      const isLowStock = item.quantity <= item.minStockLevel;
                      return (
                        <TableRow key={item.id} className={`hover:bg-secondary/5 ${isLowStock ? "bg-red-50" : ""}`}>
                          <TableCell className="font-semibold text-primary">{item.name}</TableCell>
                          <TableCell><Badge className="bg-sky-50 text-sky-700 border-0">{item.category}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.unit}</TableCell>
                          <TableCell className={`text-center font-bold ${isLowStock ? "text-red-600" : ""}`}>{item.quantity}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{item.minStockLevel}</TableCell>
                          <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">${(item.quantity * item.unitPrice).toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            {isLowStock ? (
                              <Badge className="bg-red-100 text-red-700 border-0 gap-1">
                                <AlertTriangle className="h-3 w-3" /> Low Stock
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-0">
                                <CheckCircle2 className="h-3 w-3" /> In Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
