using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

// Local, interactive desktop utility. Uses the user's installed Microsoft Word.
// No server, network, macro execution, source edits, or PDF overwrites.
public static class WordToPdf
{
    [STAThread]
    public static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        bool interactive = args.Length == 0;
        string output = null;
        var files = new List<string>();
        if (interactive)
        {
            using (var picker = new OpenFileDialog())
            {
                picker.Title = "選取一份或多份 Word 文件";
                picker.Filter = "Word 文件 (*.doc;*.docx)|*.doc;*.docx";
                picker.Multiselect = true;
                if (picker.ShowDialog() != DialogResult.OK) return 0;
                files.AddRange(picker.FileNames);
            }
            using (var folder = new FolderBrowserDialog())
            {
                folder.Description = "選擇儲存 PDF 的資料夾";
                if (folder.ShowDialog() != DialogResult.OK) return 0;
                output = folder.SelectedPath;
            }
        }
        else
        {
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--output" && i + 1 < args.Length) output = args[++i];
                else files.Add(args[i]);
            }
        }
        if (String.IsNullOrEmpty(output) || files.Count == 0)
        {
            Console.Error.WriteLine("Usage: Word-to-PDF.exe --output DIRECTORY FILE.docx [FILE.doc ...]");
            return 1;
        }
        object word = null;
        int succeeded = 0, failed = 0;
        var log = new StringBuilder("File,Status,PDF,Error\r\n");
        try
        {
            output = Path.GetFullPath(output);
            Directory.CreateDirectory(output);
            Type wordType = Type.GetTypeFromProgID("Word.Application");
            if (wordType == null) throw new InvalidOperationException("需要已安裝及啟用 Microsoft Word 桌面版。");
            word = Activator.CreateInstance(wordType);
            Set(word, "Visible", false);
            Set(word, "DisplayAlerts", 0);
            Set(word, "AutomationSecurity", 3);
            foreach (string input in files)
            {
                object doc = null;
                try
                {
                    string source = Path.GetFullPath(input);
                    string extension = Path.GetExtension(source).ToLowerInvariant();
                    if (extension != ".doc" && extension != ".docx") throw new InvalidOperationException("只支援 DOC / DOCX。");
                    if (!File.Exists(source)) throw new FileNotFoundException("找不到檔案。", source);
                    string stem = Path.GetFileNameWithoutExtension(source);
                    string pdf = Path.Combine(output, stem + ".pdf");
                    int suffix = 2;
                    while (File.Exists(pdf)) pdf = Path.Combine(output, stem + " (" + suffix++ + ").pdf");
                    Console.WriteLine("[" + (succeeded + failed + 1) + "/" + files.Count + "] " + Path.GetFileName(source));
                    Console.WriteLine("Opening document...");
                    object documents = word.GetType().InvokeMember("Documents", BindingFlags.GetProperty, null, word, null);
                    try { doc = Call(documents, "Open", source, false, true, false); }
                    finally { Marshal.FinalReleaseComObject(documents); }
                    Console.WriteLine("Exporting PDF...");
                    // Word's own PDF export, equivalent to File > Export > PDF.
                    Call(doc, "ExportAsFixedFormat", pdf, 17);
                    Console.WriteLine("PDF exported.");
                    if (!File.Exists(pdf) || new FileInfo(pdf).Length == 0) throw new IOException("未能產生 PDF。");
                    log.AppendLine(Csv(source) + ",OK," + Csv(pdf) + ",");
                    succeeded++;
                }
                catch (Exception error)
                {
                    log.AppendLine(Csv(input) + ",Failed,," + Csv(error.Message));
                    Console.Error.WriteLine(error.Message);
                    failed++;
                }
                finally
                {
                    if (doc != null)
                    {
                        try { Call(doc, "Close", 0); } catch (Exception cleanupError) { Console.Error.WriteLine("Close: " + cleanupError.Message); }
                        Marshal.FinalReleaseComObject(doc);
                    }
                }
            }
            File.WriteAllText(Path.Combine(output, "conversion-results-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".csv"), log.ToString(), new UTF8Encoding(true));
            string summary = "完成：" + succeeded + " 份成功，" + failed + " 份失敗。\r\n儲存位置：" + output;
            Console.WriteLine(summary);
            if (interactive) MessageBox.Show(summary, "幫緊你 · Word 轉 PDF", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            if (interactive) MessageBox.Show(error.Message, "未能完成轉換", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            if (word != null)
            {
                try { Call(word, "Quit", 0); } catch (Exception cleanupError) { Console.Error.WriteLine("Quit: " + cleanupError.Message); }
                Marshal.FinalReleaseComObject(word);
            }
        }
        return failed == 0 ? 0 : 1;
    }

    private static object Call(object target, string name, params object[] args)
    {
        return target.GetType().InvokeMember(name, BindingFlags.InvokeMethod | BindingFlags.OptionalParamBinding, null, target, args);
    }

    private static void Set(object target, string name, object value)
    {
        target.GetType().InvokeMember(name, BindingFlags.SetProperty, null, target, new object[] { value });
    }

    private static string Csv(string value)
    {
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
}
