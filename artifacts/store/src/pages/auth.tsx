import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Package } from "lucide-react";

export default function Auth() {
  const { login, register, user } = useAuth();
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");

  if (user) {
    setLocation(user.role === "admin" ? "/admin" : "/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await login({ data: { email: loginEmail, password: loginPassword } });
      setLocation(res.user?.role === "admin" ? "/admin" : "/");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await register({
        data: {
          firstName: regFirstName,
          lastName: regLastName,
          email: regEmail,
          password: regPassword,
          phone: regPhone
        }
      });
      setLocation(res.user?.role === "admin" ? "/admin" : "/");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-400px)] flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md bg-card border border-border shadow-lg rounded-2xl p-8">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Package className="h-8 w-8" />
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-muted p-1">
              <TabsTrigger value="login" className="text-base rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">התחברות</TabsTrigger>
              <TabsTrigger value="register" className="text-base rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">הרשמה</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>אימייל</Label>
                  <Input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>סיסמה</Label>
                  <Input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-12 text-lg font-bold mt-4">התחבר</Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שם פרטי</Label>
                    <Input required value={regFirstName} onChange={e => setRegFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>שם משפחה</Label>
                    <Input required value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>אימייל</Label>
                  <Input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>טלפון (אופציונלי)</Label>
                  <Input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>סיסמה</Label>
                  <Input type="password" required value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-12 text-lg font-bold mt-4">צור חשבון</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
