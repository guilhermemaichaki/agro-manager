"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Mail, UserPlus, Shield, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-helpers";
import type { FarmMember, FarmInvitation, UserProfile, UserRole } from "@/types/schema";
import { UserRole as UserRoleEnum } from "@/types/schema";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
});

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "manager", "operator", "viewer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;
type UpdateRoleFormValues = z.infer<typeof updateRoleSchema>;

interface FarmMemberWithUser extends FarmMember {
  user?: UserProfile;
}

// Funções para buscar dados
async function fetchFarmMembers(farmId: string): Promise<FarmMemberWithUser[]> {
  const { data, error } = await supabase
    .from("farm_members")
    .select(`
      *,
      user:user_profiles(*)
    `)
    .eq("farm_id", farmId)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar membros: ${error.message}`);
  }

  return data || [];
}

async function fetchFarmInvitations(farmId: string): Promise<FarmInvitation[]> {
  const { data, error } = await supabase
    .from("farm_invitations")
    .select("*")
    .eq("farm_id", farmId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar convites: ${error.message}`);
  }

  return data || [];
}

// Funções para ações
async function inviteUser(farmId: string, email: string, role: UserRole, invitedBy: string) {
  // Gerar token único
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

  const { data, error } = await supabase
    .from("farm_invitations")
    .insert({
      farm_id: farmId,
      email,
      role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao enviar convite: ${error.message}`);
  }

  // TODO: Enviar email com link de convite
  // O link seria: /accept-invitation?token={token}
  
  return data;
}

async function updateMemberRole(memberId: string, role: UserRole) {
  const { data, error } = await supabase
    .from("farm_members")
    .update({ role })
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar permissão: ${error.message}`);
  }

  return data;
}

async function removeMember(memberId: string) {
  const { error } = await supabase
    .from("farm_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    throw new Error(`Erro ao remover membro: ${error.message}`);
  }
}

async function cancelInvitation(invitationId: string) {
  const { error } = await supabase
    .from("farm_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    throw new Error(`Erro ao cancelar convite: ${error.message}`);
  }
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    manager: "Gerente",
    operator: "Operador",
    viewer: "Visualizador",
  };
  return labels[role] || role;
}

function getRoleBadgeVariant(role: UserRole): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

export default function FarmUsersPage() {
  const params = useParams();
  const router = useRouter();
  const farmId = params.id as string;
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FarmMemberWithUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["farm-members", farmId],
    queryFn: () => fetchFarmMembers(farmId),
  });

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    queryKey: ["farm-invitations", farmId],
    queryFn: () => fetchFarmInvitations(farmId),
  });

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "viewer",
    },
  });

  const updateRoleForm = useForm<UpdateRoleFormValues>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      role: "viewer",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const user = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");
      return inviteUser(farmId, data.email, data.role as UserRole, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-invitations", farmId] });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      setInviteEmail("");
    },
    onError: (error: Error) => {
      alert(`Erro ao enviar convite: ${error.message}`);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: UpdateRoleFormValues) => {
      if (!editingMember) throw new Error("Membro não selecionado");
      return updateMemberRole(editingMember.id, data.role as UserRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-members", farmId] });
      setEditingMember(null);
      updateRoleForm.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar permissão: ${error.message}`);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-members", farmId] });
    },
    onError: (error: Error) => {
      alert(`Erro ao remover membro: ${error.message}`);
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farm-invitations", farmId] });
    },
    onError: (error: Error) => {
      alert(`Erro ao cancelar convite: ${error.message}`);
    },
  });

  const handleEditMember = (member: FarmMemberWithUser) => {
    setEditingMember(member);
    updateRoleForm.setValue("role", member.role);
  };

  const handleRemoveMember = (memberId: string, role: UserRole) => {
    if (role === "owner") {
      alert("Não é possível remover o proprietário da fazenda.");
      return;
    }
    if (confirm("Tem certeza que deseja remover este membro?")) {
      removeMemberMutation.mutate(memberId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">
            Convidar usuários e gerenciar permissões da fazenda
          </p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Usuário</DialogTitle>
              <DialogDescription>
                Envie um convite por email para adicionar um novo usuário à fazenda.
              </DialogDescription>
            </DialogHeader>
            <Form {...inviteForm}>
              <form
                onSubmit={inviteForm.handleSubmit((data) => inviteMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="usuario@exemplo.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permissão</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma permissão" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Administrador: controle total exceto deletar fazenda
                        <br />
                        Gerente: criar, editar e visualizar
                        <br />
                        Operador: criar aplicações e visualizar
                        <br />
                        Visualizador: apenas visualização
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Membros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membros da Fazenda
          </CardTitle>
          <CardDescription>
            Usuários com acesso à fazenda
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user?.full_name || "Sem nome"}
                    </TableCell>
                    <TableCell>{member.user?.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.accepted_at ? (
                        <Badge variant="outline">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {member.role !== "owner" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditMember(member)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveMember(member.id, member.role)
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
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

      {/* Convites Pendentes */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Convites Pendentes
            </CardTitle>
            <CardDescription>
              Convites enviados aguardando aceitação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {getRoleLabel(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          cancelInvitationMutation.mutate(invitation.id)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog para editar permissão */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Permissão</DialogTitle>
              <DialogDescription>
                Alterar permissão de {editingMember.user?.full_name || editingMember.user?.email}
              </DialogDescription>
            </DialogHeader>
            <Form {...updateRoleForm}>
              <form
                onSubmit={updateRoleForm.handleSubmit((data) =>
                  updateRoleMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={updateRoleForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permissão</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={editingMember.role === "owner"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma permissão" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingMember(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateRoleMutation.isPending || editingMember.role === "owner"}
                  >
                    {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
