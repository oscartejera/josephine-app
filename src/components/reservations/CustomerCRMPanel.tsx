import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Users, Phone, Mail, Calendar, Euro, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  tags?: { id: string; name: string; color: string }[];
}

interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export function CustomerCRMPanel() {
  const { groupId } = useApp();
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', notes: '' });

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    if (!groupId) return;

    const [customersRes, tagsRes] = await Promise.all([
      supabase
        .from('customer_profiles')
        .select('*')
        .eq('group_id', groupId)
        .order('total_visits', { ascending: false }),
      supabase
        .from('customer_tags')
        .select('*')
        .eq('group_id', groupId)
    ]);

    // Fetch tags for each customer
    const customersWithTags = await Promise.all(
      (customersRes.data || []).map(async (customer) => {
        const { data: profileTags } = await supabase
          .from('customer_profile_tags')
          .select('tag_id')
          .eq('customer_profile_id', customer.id);
        
        const customerTags = (profileTags || [])
          .map(pt => (tagsRes.data || []).find(t => t.id === pt.tag_id))
          .filter(Boolean) as CustomerTag[];

        return { ...customer, tags: customerTags };
      })
    );

    setCustomers(customersWithTags);
    setTags((tagsRes.data || []) as CustomerTag[]);
    setLoading(false);
  };

  const createCustomer = async () => {
    if (!groupId || !newCustomer.name) return;

    try {
      const { error } = await supabase.from('customer_profiles').insert({
        group_id: groupId,
        name: newCustomer.name,
        email: newCustomer.email || null,
        phone: newCustomer.phone || null,
        notes: newCustomer.notes || null,
      });

      if (error) throw error;

      toast.success('Cliente creado correctamente');
      setShowCreateDialog(false);
      setNewCustomer({ name: '', email: '', phone: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Error al crear el cliente');
    }
  };

  const toggleTag = async (customerId: string, tagId: string, hasTag: boolean) => {
    try {
      if (hasTag) {
        await supabase
          .from('customer_profile_tags')
          .delete()
          .eq('customer_profile_id', customerId)
          .eq('tag_id', tagId);
      } else {
        await supabase
          .from('customer_profile_tags')
          .insert({ customer_profile_id: customerId, tag_id: tagId });
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling tag:', error);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Customer List */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Base de Datos de Clientes
          </CardTitle>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{customer.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {customer.total_visits} visitas
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Euro className="h-3 w-3" />
                        {customer.total_spent.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {customer.tags.map(tag => (
                        <Badge
                          key={tag.id}
                          style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                          variant="outline"
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Tags Panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Etiquetas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tags.map(tag => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium">{tag.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {customers.filter(c => c.tags?.some(t => t.id === tag.id)).length}
                </span>
              </div>
            ))}
          </div>

          {selectedCustomer && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Etiquetas de {selectedCustomer.name}</h4>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const hasTag = selectedCustomer.tags?.some(t => t.id === tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={hasTag ? 'default' : 'outline'}
                      className="cursor-pointer"
                      style={hasTag ? { backgroundColor: tag.color } : {}}
                      onClick={() => toggleTag(selectedCustomer.id, tag.id, hasTag || false)}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="+34 600 000 000"
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                placeholder="Alergias, preferencias..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={createCustomer} disabled={!newCustomer.name}>
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
