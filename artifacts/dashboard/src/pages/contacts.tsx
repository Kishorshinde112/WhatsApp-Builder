import { useState } from "react";
import {
  useGetContacts,
  getGetContactsQueryKey,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import { Link } from "wouter";

type Contact = {
  id: number;
  name?: string | null;
  phone: string;
  normalizedPhone?: string | null;
  email?: string | null;
  tags?: string[] | null;
  validationStatus?: string | null;
};

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [validationStatus, setValidationStatus] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTags, setFormTags] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    page,
    limit,
    ...(search ? { search } : {}),
    ...(validationStatus !== "all" ? { validationStatus } : {}),
  };

  const { data: contacts, isLoading } = useGetContacts({ query: { queryKey: getGetContactsQueryKey(params) } });

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey(params) });

  const openNew = () => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormTags("");
    setSheetOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingContact(c);
    setFormName(c.name ?? "");
    setFormPhone(c.phone);
    setFormEmail(c.email ?? "");
    setFormTags((c.tags ?? []).join(", "));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
    try {
      if (editingContact) {
        await updateContact.mutateAsync({
          id: editingContact.id,
          data: { name: formName, email: formEmail || undefined, tags },
        });
        toast({ title: "Contact updated" });
      } else {
        await createContact.mutateAsync({
          data: { name: formName, phone: formPhone, email: formEmail || undefined, tags },
        });
        toast({ title: "Contact created" });
      }
      invalidate();
      setSheetOpen(false);
    } catch {
      toast({ title: "Failed to save contact", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteContact.mutateAsync({ id: deleteId });
      toast({ title: "Contact deleted" });
      invalidate();
    } catch {
      toast({ title: "Failed to delete contact", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const list = Array.isArray(contacts) ? contacts : (contacts as { contacts?: Contact[] })?.contacts ?? [];
  const total = Array.isArray(contacts) ? list.length : (contacts as { total?: number })?.total ?? list.length;

  return (
    <div className="space-y-6" data-testid="contacts-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <div className="flex gap-2">
          <Link href="/contacts/import">
            <Button variant="outline" size="sm" data-testid="import-btn">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </Link>
          <Button size="sm" onClick={openNew} data-testid="add-contact-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="contact-search"
          />
        </div>
        <Select value={validationStatus} onValueChange={(v) => { setValidationStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} contact{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  No contacts found.{" "}
                  <button className="text-primary hover:underline" onClick={openNew}>Add one</button>
                </TableCell>
              </TableRow>
            ) : (
              list.map((contact) => (
                <TableRow key={contact.id} data-testid={`contact-row-${contact.id}`}>
                  <TableCell className="font-medium">{contact.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{contact.normalizedPhone ?? contact.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contact.validationStatus ?? "pending"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)} data-testid={`edit-contact-${contact.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(contact.id)} data-testid={`delete-contact-${contact.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={list.length < limit} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>{editingContact ? "Edit Contact" : "Add Contact"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" data-testid="contact-name-input" />
            </div>
            {!editingContact && (
              <div className="space-y-2">
                <Label htmlFor="c-phone">Phone <span className="text-destructive">*</span></Label>
                <Input id="c-phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+5511999990001" data-testid="contact-phone-input" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" data-testid="contact-email-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-tags">Tags (comma separated)</Label>
              <Input id="c-tags" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="vip, cliente, novo" data-testid="contact-tags-input" />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createContact.isPending || updateContact.isPending} data-testid="save-contact-btn">
              {editingContact ? "Save changes" : "Add Contact"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the contact and all their campaign data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" data-testid="confirm-delete-btn">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
