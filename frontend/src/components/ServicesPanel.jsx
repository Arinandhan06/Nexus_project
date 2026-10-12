import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Upload, MessageCircle } from "lucide-react";

const services = [
  { icon: Upload, label: "Upload Resume", path: "/upload-resume" },
  { icon: MessageCircle, label: "Career Chatbot", path: "/career-chatbot" },
];

export default function ServicesPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex gap-4 mt-6 w-full"
    >
      {services.map((service, index) => (
        <motion.div
          key={service.label}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + index * 0.1 }}
        >
          <Link to={service.path} className="btn-secondary flex items-center justify-center gap-2 w-full">
            <service.icon size={18} className="group-hover:scale-110 transition-transform" />
            <span>{service.label}</span>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
