// UploadResume.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle, ArrowLeft, X, Briefcase } from "lucide-react";
import axios from "axios";
import { useProgressStore } from "../store/useProgressStore";

export default function UploadResume() {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const navigate = useNavigate();
  const { setProfile, setProjects } = useProgressStore();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const isValidType =
        selectedFile.type === "application/pdf" ||
        selectedFile.type === "text/plain" ||
        selectedFile.name.endsWith(".txt") ||
        selectedFile.name.endsWith(".pdf");

      if (isValidType) {
        setFile(selectedFile);
      } else {
        alert("Please upload a PDF or Text file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !targetRole) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_role", targetRole);

    try {
      const response = await axios.post("http://localhost:8000/analyze", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Analysis Result:", response.data);

      setProfile(response.data.profile);
      setProjects(response.data.projects);

      setUploading(false);
      setUploaded(true);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to analyze resume. Please try again.");
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploaded(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-screen bg-transparent"
    >
      <div className="p-6">
        <Link to="/project-lab" className="flex items-center gap-2 text-neon hover:text-neon/80 transition-colors mb-8">
          <ArrowLeft size={20} />
          Back to Project Lab
        </Link>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-neon mb-8 text-center">Upload Resume</h1>

          <motion.div
            className="card p-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-center mb-8">
              <Upload className="text-neon mx-auto mb-4" size={64} />
              <h2 className="text-xl font-semibold mb-2">Resume Analysis</h2>
              <p className="text-gray-400">
                Upload your resume in PDF or Text format and get instant AI-powered feedback and optimization suggestions.
              </p>
            </div>

            {!uploaded && (
              <div className="mb-6">
                <label className="block text-gray-400 mb-2 text-sm">Target Role</label>
                <div className="flex items-center bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 focus-within:border-neon transition-colors">
                  <Briefcase size={20} className="text-gray-400 mr-3" />
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="bg-transparent border-none outline-none text-white w-full placeholder-gray-500"
                    placeholder="e.g. Frontend Developer"
                  />
                </div>
              </div>
            )}

            {!file && !uploaded && (
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-neon/50 transition-colors">
                <FileText className="text-gray-400 mx-auto mb-4" size={48} />
                <p className="text-gray-400 mb-4">Drag and drop your resume here, or click to browse</p>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="btn-primary cursor-pointer inline-block"
                >
                  Choose File
                </label>
                <p className="text-xs text-gray-500 mt-2">PDF and Text files are supported</p>
              </div>
            )}

            {file && !uploaded && (
              <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="text-neon" size={24} />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={removeFile}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {file && !uploaded && (
              <button
                onClick={handleUpload}
                disabled={uploading || !targetRole}
                className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Running Market Agents...
                  </>
                ) : (
                  "Upload & Analyze"
                )}
              </button>
            )}

            {uploaded && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <CheckCircle className="text-green-500 mx-auto mb-4" size={64} />
                <h3 className="text-xl font-semibold mb-2">Resume Uploaded Successfully!</h3>
                <p className="text-gray-400 mb-6">
                  Our Market Agents have analyzed your profile against current job trends.
                </p>
                <div className="space-y-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Analysis Complete</h4>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-neon h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <Link to="/project-lab" className="btn-secondary block">
                    View Generated Projects
                  </Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
