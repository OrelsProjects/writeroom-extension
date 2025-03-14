import Sidebar from "@/content/sidebar";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <Sidebar>
      <Outlet />
    </Sidebar>
  );
};

export default Layout;
