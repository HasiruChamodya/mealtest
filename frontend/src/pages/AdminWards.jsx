import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";

const API_BASE = "http://localhost:5050/api/wards";

const getAuthHeaders = () => {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const AdminWards = () => {
  const { toast } = useToast();
  
  const [wards, setWards] = useState([]);
  const [editWard, setEditWard] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchWards = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch wards");
      }

      setWards(data.wards || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not load wards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWards();
  }, []);

  const openNew = () => {
    setIsNew(true);
    setEditWard({ 
      id: "", 
      code: "", 
      name: "", 
      beds: 0, 
      cots: 0, 
      icu: 0, 
      incubators: 0, 
      active: true 
    });
  };

  const save = async () => {
    if (!editWard) return;

    try {
      setSaving(true);
      
      const payload = {
        code: editWard.code,
        name: editWard.name,
        beds: editWard.beds,
        cots: editWard.cots,
        icu: editWard.icu,
        incubators: editWard.incubators,
        active: editWard.active
      };

      let res;
      if (isNew) {
        res = await fetch(API_BASE, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/${editWard.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Save failed");
      }

      toast({
        title: isNew ? "Ward Added" : "Ward Updated",
        description: data.message,
      });

      setEditWard(null);
      setIsNew(false);
      fetchWards(); // Refresh the list
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not save ward",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (ward) => {
    try {
      const res = await fetch(`${API_BASE}/${ward.id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !ward.active }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Status update failed");
      }

      toast({
        title: "Ward Status Updated",
        description: data.message,
      });

      fetchWards(); // Refresh the list to reflect status changes
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not update status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-md font-bold text-foreground">Ward Management</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Ward</Button>
      </div>
      
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {loading ? (
            <div className="py-6 text-center text-muted-foreground">
              Loading wards...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Beds</TableHead>
                  <TableHead className="text-right">Cots</TableHead>
                  <TableHead className="text-right">ICU</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wards.map((w) => (
                  <TableRow key={w.id} className={!w.active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{w.code}</TableCell>
                    <TableCell>{w.name}</TableCell>
                    <TableCell className="text-right">{w.beds}</TableCell>
                    <TableCell className="text-right">{w.cots}</TableCell>
                    <TableCell className="text-right">{w.icu}</TableCell>
                    <TableCell className="text-right font-bold">{w.beds + w.cots + w.icu}</TableCell>
                    <TableCell>
                      <Badge className={w.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}>
                        {w.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setIsNew(false); setEditWard(w); }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleStatus(w)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {wards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      No wards found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editWard} onOpenChange={() => setEditWard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isNew ? "Add Ward" : "Edit Ward"}</DialogTitle></DialogHeader>
          {editWard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ward Code</Label>
                  <Input 
                    value={editWard.code} 
                    onChange={(e) => setEditWard({ ...editWard, code: e.target.value })} 
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input 
                    value={editWard.name} 
                    onChange={(e) => setEditWard({ ...editWard, name: e.target.value })} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Beds</Label>
                  <Input 
                    type="number" 
                    value={editWard.beds} 
                    onChange={(e) => setEditWard({ ...editWard, beds: parseInt(e.target.value) || 0 })} 
                  />
                </div>
                <div>
                  <Label>Cots</Label>
                  <Input 
                    type="number" 
                    value={editWard.cots} 
                    onChange={(e) => setEditWard({ ...editWard, cots: parseInt(e.target.value) || 0 })} 
                  />
                </div>
                <div>
                  <Label>ICU</Label>
                  <Input 
                    type="number" 
                    value={editWard.icu} 
                    onChange={(e) => setEditWard({ ...editWard, icu: parseInt(e.target.value) || 0 })} 
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWard(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : isNew ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWards;