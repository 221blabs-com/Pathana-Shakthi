import React, { useState } from "react";
import { motion } from "motion/react";
import { TextbookAnalysis } from "../../types";
import { soundEffects } from "../../services/soundEffects";

import {
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  X,
  FileText,
  Brain,
  Lightbulb,
  Target,
  Languages,
  RotateCcw,
} from "lucide-react";


interface TextbookOCRModalProps {
  onClose: () => void;
  onAnalysisComplete: (
    analysis: TextbookAnalysis
  ) => void;
}


// =========================================================
// SAMPLE TEXTBOOKS
// =========================================================

const SAMPLE_TEXTBOOKS = [
  {
    name: "Telugu Story Class 3",
    subject: "Telugu Reader",
    grade: "Class 3",
    language: "Telugu",
    sampleText:
      "మా ఊరి చెరువు ఎంతో అందమైనది. వర్షాకాలంలో చెరువు నీటితో నిండి కనువిందు చేస్తుంది. రైతులు చెరువు నీటితో వరి, చెరకు పంటలు పండిస్తారు.",
    summary:
      "This chapter teaches children about the importance of village ponds, rainwater, farming and the natural environment.",
  },

  {
    name: "Hindi Story Class 2",
    subject: "Hindi Rimjhim",
    grade: "Class 2",
    language: "Hindi",
    sampleText:
      "हरी डाल पर लगी हुई थी, नन्हीं सुंदर एक कली। तितली उससे आकर बोली, तुम लगती हो बड़ी भली।",
    summary:
      "A joyful lesson about nature and the friendship between a butterfly and a flower.",
  },

  {
    name: "Primary EVS Class 3",
    subject: "Environmental Studies",
    grade: "Class 3",
    language: "English",
    sampleText:
      "When the hot sun shines on ponds and rivers, water warms up and turns into invisible vapor. It rises into the cool sky to form clouds and brings rain back to the earth.",
    summary:
      "A lesson explaining evaporation, condensation, cloud formation and rainfall.",
  },
];


// =========================================================
// COMPONENT
// =========================================================

export const TextbookOCRModal: React.FC<
  TextbookOCRModalProps
> = ({
  onClose,
  onAnalysisComplete,
}) => {

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<{
    name: string;
    data: string;
    mimeType: string;
  } | null>(null);


  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);


  const [
    analysisResult,
    setAnalysisResult,
  ] =
    useState<TextbookAnalysis | null>(
      null
    );


  const [
    errorMsg,
    setErrorMsg,
  ] =
    useState<string | null>(null);


  const [
    analysisStage,
    setAnalysisStage,
  ] = useState(
    ""
  );


  // =======================================================
  // FILE UPLOAD
  // =======================================================

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file =
      e.target.files?.[0];

    if (!file) return;


    // -----------------------------------------------------
    // Validate file type
    // -----------------------------------------------------

    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
    ];


    const validExtension =
      /\.(pdf|jpg|jpeg|png|webp)$/i.test(
        file.name
      );


    if (
      !validTypes.includes(
        file.type
      ) &&
      !validExtension
    ) {

      setErrorMsg(
        "Please upload a PDF, JPG, PNG or WEBP file."
      );

      return;
    }


    // -----------------------------------------------------
    // 100 MB frontend protection
    // -----------------------------------------------------

    if (
      file.size >
      100 * 1024 * 1024
    ) {

      setErrorMsg(
        "The file is too large. Please upload a file smaller than 100 MB."
      );

      return;
    }


    setErrorMsg(null);
    setAnalysisResult(null);


    const reader =
      new FileReader();


    reader.onload = (
      event
    ) => {

      const dataUrl =
        event.target?.result as string;


      setSelectedFile({
        name: file.name,
        data: dataUrl,
        mimeType:
          file.type ||
          (
            file.name
              .toLowerCase()
              .endsWith(".pdf")
              ? "application/pdf"
              : "image/jpeg"
          ),
      });


      soundEffects.playWordPop();
    };


    reader.onerror = () => {

      setErrorMsg(
        "Failed to read uploaded file."
      );
    };


    reader.readAsDataURL(file);
  };


  // =======================================================
  // RUN OCR + AI ANALYSIS
  // =======================================================

  const handleAnalyzeDocument =
    async () => {

      if (!selectedFile) return;


      setIsAnalyzing(true);
      setErrorMsg(null);


      try {

        // -------------------------------------------------
        // Stage 1
        // -------------------------------------------------

        setAnalysisStage(
          "Uploading textbook..."
        );


        soundEffects.playPageTurn();


        // Small delay gives the UI time to show the stage.
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 250)
        );


        // -------------------------------------------------
        // Stage 2
        // -------------------------------------------------

        setAnalysisStage(
          "PaddleOCR is reading every page..."
        );


        const res =
          await fetch(
            "/api/ocr/analyze-textbook",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                fileData:
                  selectedFile.data,

                mimeType:
                  selectedFile.mimeType,

                fileName:
                  selectedFile.name,
              }),
            }
          );


        // -------------------------------------------------
        // Handle non-JSON server response
        // -------------------------------------------------

        let data: any;

        try {

          data =
            await res.json();

        } catch {

          throw new Error(
            `Server returned an invalid response (${res.status}).`
          );
        }


        if (
          !res.ok ||
          !data.success
        ) {

          throw new Error(
            data.error ||
              "Failed to process textbook."
          );
        }


        // -------------------------------------------------
        // Stage 3
        // -------------------------------------------------

        setAnalysisStage(
          "Gemini is understanding the textbook..."
        );


        await new Promise(
          (resolve) =>
            setTimeout(resolve, 250)
        );


        // -------------------------------------------------
        // Result
        // -------------------------------------------------

        const analysis =
          data.analysis;


        if (!analysis) {

          throw new Error(
            "The server did not return textbook analysis."
          );
        }


        setAnalysisResult(
          analysis
        );


        soundEffects.playVictoryFanfare();


      } catch (err: any) {

        console.warn(
          "OCR processing error:",
          err
        );


        setErrorMsg(
          err.message ||
            "OCR processing failed. Check that PaddleOCR and the backend server are running."
        );

      } finally {

        setIsAnalyzing(false);
        setAnalysisStage("");
      }
    };


  // =======================================================
  // LOAD SAMPLE
  // =======================================================

  const handleLoadSample = (
    sample: typeof SAMPLE_TEXTBOOKS[0]
  ) => {

    soundEffects.playWordPop();


    const mockAnalysis: TextbookAnalysis =
      {
        subject:
          sample.subject,

        grade:
          sample.grade,

        chapterNumber:
          "Chapter 3",

        chapterTitle:
          sample.name,

        primaryLanguage:
          sample.language as any,

        extractedText:
          sample.sampleText,

        summary:
          sample.summary,

        keyVocabulary: [
          {
            word:
              sample.language ===
              "Telugu"
                ? "చెరువు"
                : sample.language ===
                  "Hindi"
                ? "तितली"
                : "Evaporation",

            meaning:
              "Important lesson concept",

            phonetic:
              "Pronunciation guide",
          },

          {
            word:
              sample.language ===
              "Telugu"
                ? "వర్షాకాలం"
                : sample.language ===
                  "Hindi"
                ? "कली"
                : "Condensation",

            meaning:
              "Important textbook term",

            phonetic:
              "Pronunciation guide",
          },
        ],

        learningObjectives: [
          "Understand the main concept of the lesson",

          `Learn important vocabulary in ${sample.language}`,

          "Develop reading comprehension",
        ],

        suggestedStoryThemes: [
          "Learning Through Adventure",
          "Helpful Friends in Nature",
        ],
      };


    setAnalysisResult(
      mockAnalysis
    );
  };


  // =======================================================
  // RESET
  // =======================================================

  const handleScanAnother =
    () => {

      setAnalysisResult(null);
      setSelectedFile(null);
      setErrorMsg(null);
      setAnalysisStage("");
    };


  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div
      className="
        fixed inset-0 z-50
        bg-[#2d2d2d]/60
        backdrop-blur-sm
        flex items-center justify-center
        p-4
        select-none
        overflow-y-auto
        font-sans
      "
      id="ocr-modal-overlay"
    >

      <motion.div
        initial={{
          scale: 0.92,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        className="
          bg-white
          rounded-3xl
          max-w-4xl
          w-full
          shadow-2xl
          border border-[#e8e4d8]
          relative
          my-auto
          max-h-[92vh]
          flex flex-col
          overflow-hidden
        "
        id="ocr-modal-card"
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex items-center justify-between
            border-b border-[#f0ece1]
            px-5 sm:px-7
            py-4
            bg-white
            shrink-0
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                p-2.5
                bg-[#fff8e6]
                text-amber-900
                rounded-2xl
                border border-[#fae2a0]
              "
            >
              <Sparkles
                className="
                  w-5 h-5
                  text-amber-600
                "
              />
            </div>


            <div>

              <h2
                className="
                  text-lg sm:text-xl
                  font-black
                  text-[#2d2d2d]
                "
              >
                Textbook OCR & AI Analysis
              </h2>

              <p
                className="
                  text-xs
                  text-stone-500
                  font-medium
                  mt-0.5
                "
              >
                PaddleOCR → Gemini → Important Educational Context
              </p>

            </div>

          </div>


          <button
            type="button"
            onClick={onClose}
            className="
              p-2
              bg-[#f4f1e8]
              hover:bg-[#eae5d8]
              text-stone-600
              rounded-full
              transition-all
              border border-[#e5e1d5]
            "
          >
            <X className="w-4 h-4" />
          </button>

        </div>


        {/* =================================================
            SCROLLABLE BODY
        ================================================= */}

        <div
          className="
            overflow-y-auto
            px-5 sm:px-7
            py-5
          "
        >

          {/* =================================================
              UPLOAD SCREEN
          ================================================= */}

          {!analysisResult ? (

            <div className="space-y-5">

              {/* Upload */}
              <label
                htmlFor="textbook-file-input"
                className="
                  border-2
                  border-dashed
                  border-[#d8d3c5]
                  hover:border-[#2d2d2d]
                  bg-[#fbf9f4]
                  hover:bg-[#f5f1e6]
                  rounded-3xl
                  p-8 sm:p-12
                  flex flex-col
                  items-center
                  justify-center
                  cursor-pointer
                  transition-all
                  text-center
                "
              >

                <div
                  className="
                    w-16 h-16
                    rounded-2xl
                    bg-[#f4f1e8]
                    text-[#2d2d2d]
                    border border-[#e8e4d8]
                    flex items-center
                    justify-center
                    mb-4
                  "
                >
                  <Upload className="w-7 h-7" />
                </div>


                <p
                  className="
                    text-sm
                    sm:text-base
                    font-black
                    text-[#2d2d2d]
                  "
                >
                  {selectedFile
                    ? selectedFile.name
                    : "Upload Textbook PDF"}
                </p>


                <p
                  className="
                    text-xs
                    text-stone-500
                    mt-2
                  "
                >
                  PDF, JPG, PNG or WEBP
                </p>


                <p
                  className="
                    text-[11px]
                    text-stone-400
                    mt-1
                  "
                >
                  Multi-page textbooks are supported
                </p>


                <input
                  id="textbook-file-input"
                  type="file"
                  accept="
                    application/pdf,
                    image/jpeg,
                    image/png,
                    image/webp
                  "
                  onChange={
                    handleFileUpload
                  }
                  className="hidden"
                />

              </label>


              {/* Selected file */}
              {selectedFile && (

                <div
                  className="
                    flex items-center gap-3
                    p-3.5
                    rounded-2xl
                    bg-emerald-50
                    border border-emerald-200
                  "
                >

                  <div
                    className="
                      w-10 h-10
                      rounded-xl
                      bg-white
                      border border-emerald-200
                      flex items-center
                      justify-center
                    "
                  >
                    <FileText
                      className="
                        w-5 h-5
                        text-emerald-600
                      "
                    />
                  </div>


                  <div className="min-w-0">

                    <p
                      className="
                        text-xs
                        font-black
                        text-emerald-950
                        truncate
                      "
                    >
                      {selectedFile.name}
                    </p>

                    <p
                      className="
                        text-[10px]
                        text-emerald-700
                        mt-0.5
                      "
                    >
                      Ready for PaddleOCR
                    </p>

                  </div>

                </div>
              )}


              {/* Error */}
              {errorMsg && (

                <div
                  className="
                    p-4
                    bg-rose-50
                    border border-rose-200
                    rounded-2xl
                    text-xs
                    text-rose-800
                    font-medium
                  "
                >
                  {errorMsg}
                </div>
              )}


              {/* Analyze button */}
              {selectedFile && (

                <button
                  type="button"
                  onClick={
                    handleAnalyzeDocument
                  }
                  disabled={
                    isAnalyzing
                  }
                  className="
                    w-full
                    bg-[#2d2d2d]
                    hover:bg-black
                    disabled:opacity-60
                    text-white
                    font-black
                    py-4
                    rounded-2xl
                    shadow-lg
                    transition-all
                    flex items-center
                    justify-center
                    gap-2
                    text-xs
                    sm:text-sm
                  "
                >

                  {isAnalyzing ? (

                    <>
                      <Loader2
                        className="
                          w-5 h-5
                          animate-spin
                          text-amber-400
                        "
                      />

                      <span>
                        {analysisStage ||
                          "Analyzing textbook..."}
                      </span>
                    </>

                  ) : (

                    <>
                      <Sparkles
                        className="
                          w-5 h-5
                          text-amber-400
                        "
                      />

                      <span>
                        Analyze Textbook
                      </span>
                    </>

                  )}

                </button>
              )}


              {/* Pipeline */}
              <div
                className="
                  grid
                  grid-cols-1
                  sm:grid-cols-3
                  gap-3
                  pt-2
                "
              >

                <div
                  className="
                    rounded-2xl
                    border border-stone-200
                    bg-stone-50
                    p-4
                  "
                >

                  <FileText
                    className="
                      w-5 h-5
                      text-stone-700
                    "
                  />

                  <p
                    className="
                      text-xs
                      font-black
                      mt-2
                    "
                  >
                    1. Upload
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-stone-500
                      mt-1
                    "
                  >
                    Upload the complete textbook PDF.
                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    border border-amber-200
                    bg-amber-50
                    p-4
                  "
                >

                  <Brain
                    className="
                      w-5 h-5
                      text-amber-600
                    "
                  />

                  <p
                    className="
                      text-xs
                      font-black
                      mt-2
                    "
                  >
                    2. PaddleOCR
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-stone-500
                      mt-1
                    "
                  >
                    Reads every page and extracts text.
                  </p>

                </div>


                <div
                  className="
                    rounded-2xl
                    border border-indigo-200
                    bg-indigo-50
                    p-4
                  "
                >

                  <Sparkles
                    className="
                      w-5 h-5
                      text-indigo-600
                    "
                  />

                  <p
                    className="
                      text-xs
                      font-black
                      mt-2
                    "
                  >
                    3. AI Context
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-stone-500
                      mt-1
                    "
                  >
                    Gemini identifies the important educational content.
                  </p>

                </div>

              </div>


              {/* Samples */}
              <div
                className="
                  pt-4
                  border-t
                  border-[#f0ece1]
                "
              >

                <span
                  className="
                    text-[10px]
                    font-black
                    uppercase
                    tracking-wider
                    text-stone-400
                    block
                    mb-2.5
                  "
                >
                  Quick Test Presets
                </span>


                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-3
                    gap-2.5
                  "
                >

                  {SAMPLE_TEXTBOOKS.map(
                    (
                      sample,
                      index
                    ) => (

                      <button
                        key={index}
                        type="button"
                        onClick={() =>
                          handleLoadSample(
                            sample
                          )
                        }
                        className="
                          p-3.5
                          bg-[#fbf9f4]
                          hover:bg-[#fff8e6]
                          border border-[#e8e4d8]
                          hover:border-[#fae2a0]
                          rounded-2xl
                          text-left
                          transition-all
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-black
                            text-[#2d2d2d]
                            block
                          "
                        >
                          {sample.subject}
                        </span>

                        <span
                          className="
                            text-[10px]
                            text-stone-500
                            block
                            mt-1
                          "
                        >
                          {sample.grade}
                          {" • "}
                          {sample.language}
                        </span>

                      </button>

                    )
                  )}

                </div>

              </div>

            </div>

          ) : (

            /* =================================================
               ANALYSIS RESULT
            ================================================= */

            <div
              className="
                space-y-5
              "
              id="ocr-analysis-result"
            >

              {/* Success */}
              <div
                className="
                  flex items-center gap-3
                  p-4
                  rounded-2xl
                  bg-emerald-50
                  border border-emerald-200
                "
              >

                <CheckCircle2
                  className="
                    w-6 h-6
                    text-emerald-600
                    shrink-0
                  "
                />

                <div>

                  <p
                    className="
                      text-sm
                      font-black
                      text-emerald-950
                    "
                  >
                    Textbook analyzed successfully
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-emerald-700
                      mt-0.5
                    "
                  >
                    PaddleOCR extracted the document and Gemini identified the educational context.
                  </p>

                </div>

              </div>


              {/* =================================================
                  META
              ================================================= */}

              <div
                className="
                  grid
                  grid-cols-1
                  sm:grid-cols-3
                  gap-3
                "
              >

                <div
                  className="
                    bg-[#fbf9f4]
                    p-4
                    rounded-2xl
                    border border-[#e8e4d8]
                  "
                >

                  <span
                    className="
                      text-[9px]
                      text-stone-400
                      font-black
                      uppercase
                    "
                  >
                    Subject
                  </span>

                  <p
                    className="
                      font-black
                      text-sm
                      text-[#2d2d2d]
                      mt-1
                    "
                  >
                    {analysisResult.subject}
                  </p>

                </div>


                <div
                  className="
                    bg-[#fbf9f4]
                    p-4
                    rounded-2xl
                    border border-[#e8e4d8]
                  "
                >

                  <span
                    className="
                      text-[9px]
                      text-stone-400
                      font-black
                      uppercase
                    "
                  >
                    Class / Grade
                  </span>

                  <p
                    className="
                      font-black
                      text-sm
                      text-[#2d2d2d]
                      mt-1
                    "
                  >
                    {analysisResult.grade}
                  </p>

                </div>


                <div
                  className="
                    bg-[#fbf9f4]
                    p-4
                    rounded-2xl
                    border border-[#e8e4d8]
                  "
                >

                  <span
                    className="
                      text-[9px]
                      text-stone-400
                      font-black
                      uppercase
                    "
                  >
                    Language
                  </span>

                  <p
                    className="
                      font-black
                      text-sm
                      text-[#2d2d2d]
                      mt-1
                    "
                  >
                    {analysisResult.primaryLanguage}
                  </p>

                </div>

              </div>


              {/* =================================================
                  CHAPTER
              ================================================= */}

              <div
                className="
                  bg-[#f8f6f0]
                  p-5
                  rounded-2xl
                  border border-[#e8e4d8]
                "
              >

                <div
                  className="
                    flex items-center
                    gap-2
                    text-xs
                    font-black
                    text-stone-500
                    mb-1
                  "
                >

                  <BookOpen
                    className="
                      w-4 h-4
                      text-amber-600
                    "
                  />

                  <span>
                    {analysisResult.chapterNumber ||
                      "Chapter"}
                  </span>

                </div>


                <h3
                  className="
                    text-lg
                    sm:text-xl
                    font-black
                    text-[#2d2d2d]
                  "
                >
                  {analysisResult.chapterTitle}
                </h3>

              </div>


              {/* =================================================
                  IMPORTANT CONTEXT
              ================================================= */}

              {(analysisResult as any)
                .importantContext && (

                <div
                  className="
                    p-5
                    bg-indigo-50
                    border border-indigo-200
                    rounded-2xl
                  "
                >

                  <div
                    className="
                      flex items-center
                      gap-2
                      mb-2
                    "
                  >

                    <Brain
                      className="
                        w-5 h-5
                        text-indigo-600
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        text-indigo-950
                        uppercase
                        tracking-wider
                      "
                    >
                      Important Educational Context
                    </span>

                  </div>


                  <p
                    className="
                      text-sm
                      text-stone-800
                      leading-relaxed
                      font-medium
                      whitespace-pre-line
                    "
                  >
                    {
                      (analysisResult as any)
                        .importantContext
                    }
                  </p>

                </div>

              )}


              {/* =================================================
                  SUMMARY
              ================================================= */}

              <div
                className="
                  p-5
                  bg-[#fff8e6]
                  border border-[#fae2a0]
                  rounded-2xl
                "
              >

                <div
                  className="
                    flex items-center
                    gap-2
                    mb-2
                  "
                >

                  <BookOpen
                    className="
                      w-4 h-4
                      text-amber-700
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-black
                      text-amber-950
                      uppercase
                      tracking-wider
                    "
                  >
                    Chapter Summary
                  </span>

                </div>


                <p
                  className="
                    text-sm
                    text-stone-800
                    leading-relaxed
                    font-medium
                  "
                >
                  {analysisResult.summary}
                </p>

              </div>


              {/* =================================================
                  KEY CONCEPTS
              ================================================= */}

              {(analysisResult as any)
                .keyConcepts?.length >
                0 && (

                <div
                  className="
                    p-5
                    rounded-2xl
                    bg-white
                    border border-stone-200
                  "
                >

                  <div
                    className="
                      flex items-center
                      gap-2
                      mb-3
                    "
                  >

                    <Lightbulb
                      className="
                        w-4 h-4
                        text-amber-600
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        uppercase
                        tracking-wider
                        text-stone-800
                      "
                    >
                      Key Concepts
                    </span>

                  </div>


                  <div
                    className="
                      grid
                      grid-cols-1
                      sm:grid-cols-2
                      gap-2
                    "
                  >

                    {(analysisResult as any)
                      .keyConcepts
                      .map(
                        (
                          concept: string,
                          index: number
                        ) => (

                          <div
                            key={index}
                            className="
                              flex items-start
                              gap-2
                              p-3
                              rounded-xl
                              bg-amber-50
                              border border-amber-100
                            "
                          >

                            <span
                              className="
                                w-5 h-5
                                rounded-full
                                bg-amber-500
                                text-white
                                text-[9px]
                                font-black
                                flex items-center
                                justify-center
                                shrink-0
                              "
                            >
                              {index + 1}
                            </span>

                            <span
                              className="
                                text-xs
                                font-bold
                                text-stone-700
                              "
                            >
                              {concept}
                            </span>

                          </div>

                        )
                      )}

                  </div>

                </div>
              )}


              {/* =================================================
                  VOCABULARY
              ================================================= */}

              {analysisResult
                .keyVocabulary
                ?.length > 0 && (

                <div>

                  <div
                    className="
                      flex items-center
                      gap-2
                      mb-3
                    "
                  >

                    <Languages
                      className="
                        w-4 h-4
                        text-purple-600
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        uppercase
                        tracking-wider
                        text-stone-800
                      "
                    >
                      Key Vocabulary
                    </span>

                  </div>


                  <div
                    className="
                      grid
                      grid-cols-1
                      sm:grid-cols-2
                      gap-2.5
                    "
                  >

                    {analysisResult
                      .keyVocabulary
                      .map(
                        (
                          vocabulary,
                          index
                        ) => (

                          <div
                            key={index}
                            className="
                              p-3.5
                              rounded-2xl
                              bg-[#f4f1e8]
                              border border-[#e8e4d8]
                            "
                          >

                            <p
                              className="
                                text-sm
                                font-black
                                text-[#2d2d2d]
                              "
                            >
                              {vocabulary.word}
                            </p>


                            <p
                              className="
                                text-[11px]
                                text-stone-600
                                mt-1
                              "
                            >
                              {vocabulary.meaning}
                            </p>


                            {vocabulary.phonetic && (

                              <p
                                className="
                                  text-[10px]
                                  text-stone-400
                                  mt-1
                                  italic
                                "
                              >
                                {vocabulary.phonetic}
                              </p>

                            )}

                          </div>

                        )
                      )}

                  </div>

                </div>
              )}


              {/* =================================================
                  LEARNING OBJECTIVES
              ================================================= */}

              {analysisResult
                .learningObjectives
                ?.length > 0 && (

                <div
                  className="
                    p-5
                    bg-emerald-50
                    border border-emerald-200
                    rounded-2xl
                  "
                >

                  <div
                    className="
                      flex items-center
                      gap-2
                      mb-3
                    "
                  >

                    <Target
                      className="
                        w-4 h-4
                        text-emerald-600
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        text-emerald-950
                        uppercase
                        tracking-wider
                      "
                    >
                      Learning Objectives
                    </span>

                  </div>


                  <ul
                    className="
                      space-y-2
                    "
                  >

                    {analysisResult
                      .learningObjectives
                      .map(
                        (
                          objective,
                          index
                        ) => (

                          <li
                            key={index}
                            className="
                              flex items-start
                              gap-2
                              text-xs
                              text-stone-700
                              font-medium
                            "
                          >

                            <CheckCircle2
                              className="
                                w-4 h-4
                                text-emerald-600
                                shrink-0
                                mt-0.5
                              "
                            />

                            <span>
                              {objective}
                            </span>

                          </li>

                        )
                      )}

                  </ul>

                </div>
              )}


              {/* =================================================
                  EXTRACTED TEXT
              ================================================= */}

              <div
                className="
                  rounded-2xl
                  border border-stone-200
                  overflow-hidden
                "
              >

                <div
                  className="
                    flex items-center
                    justify-between
                    gap-3
                    px-5
                    py-4
                    bg-stone-50
                    border-b border-stone-200
                  "
                >

                  <div>

                    <div
                      className="
                        flex items-center
                        gap-2
                      "
                    >

                      <FileText
                        className="
                          w-4 h-4
                          text-stone-700
                        "
                      />

                      <span
                        className="
                          text-xs
                          font-black
                          uppercase
                          tracking-wider
                          text-stone-800
                        "
                      >
                        Full OCR Extracted Text
                      </span>

                    </div>

                    <p
                      className="
                        text-[10px]
                        text-stone-400
                        mt-1
                      "
                    >
                      Text returned by PaddleOCR
                    </p>

                  </div>

                </div>


                <div
                  className="
                    bg-[#292929]
                    text-stone-100
                    p-5
                    max-h-[350px]
                    overflow-y-auto
                    whitespace-pre-wrap
                    text-[11px]
                    leading-relaxed
                    font-mono
                  "
                >
                  {analysisResult.extractedText ||
                    "No OCR text available."}
                </div>

              </div>


              {/* =================================================
                  STORY THEMES
              ================================================= */}

              {analysisResult
                .suggestedStoryThemes
                ?.length > 0 && (

                <div
                  className="
                    p-5
                    bg-rose-50
                    border border-rose-200
                    rounded-2xl
                  "
                >

                  <span
                    className="
                      text-xs
                      font-black
                      uppercase
                      tracking-wider
                      text-rose-950
                    "
                  >
                    Suggested Story Themes
                  </span>


                  <div
                    className="
                      flex flex-wrap
                      gap-2
                      mt-3
                    "
                  >

                    {analysisResult
                      .suggestedStoryThemes
                      .map(
                        (
                          theme,
                          index
                        ) => (

                          <span
                            key={index}
                            className="
                              px-3
                              py-1.5
                              rounded-xl
                              bg-white
                              border border-rose-200
                              text-xs
                              font-bold
                              text-stone-700
                            "
                          >
                            {theme}
                          </span>

                        )
                      )}

                  </div>

                </div>
              )}


              {/* =================================================
                  ACTIONS
              ================================================= */}

              <div
                className="
                  flex
                  flex-col
                  sm:flex-row
                  items-stretch
                  sm:items-center
                  justify-between
                  gap-3
                  pt-4
                  border-t border-[#f0ece1]
                "
              >

                <button
                  type="button"
                  onClick={
                    handleScanAnother
                  }
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    text-xs
                    font-bold
                    text-stone-500
                    hover:text-stone-800
                    px-4
                    py-3
                    rounded-xl
                    hover:bg-stone-100
                  "
                >

                  <RotateCcw className="w-4 h-4" />

                  Scan Another Textbook

                </button>


                <button
                  type="button"
                  onClick={() =>
                    onAnalysisComplete(
                      analysisResult
                    )
                  }
                  id="btn-generate-story-from-ocr"
                  className="
                    bg-[#2d2d2d]
                    hover:bg-black
                    text-white
                    font-black
                    text-xs
                    sm:text-sm
                    px-5
                    py-3.5
                    rounded-2xl
                    shadow-lg
                    transition-all
                    flex items-center
                    justify-center
                    gap-2
                  "
                >

                  <span>
                    Build Read-Along Story
                  </span>

                  <ArrowRight
                    className="
                      w-4 h-4
                    "
                  />

                </button>

              </div>

            </div>
          )}

        </div>

      </motion.div>

    </div>
  );
};